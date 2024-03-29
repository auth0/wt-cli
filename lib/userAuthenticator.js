var Bluebird = require('bluebird');
var Errors = require('./errors');
var Sandbox = require('sandboxjs');
var Superagent = require('superagent');
var Http = require('http');
var Url = require('url');
var Open = require('opn');
var Chalk = require('chalk');
var Decode = require('jwt-decode');
var Assert = require('assert');
var Crypto = require('crypto');

require('superagent-proxy')(Superagent)

module.exports = UserAuthenticator;

function UserAuthenticator (config) {
    if (!config) config = {};

    this.sandboxUrl = config.sandboxUrl || 'https://sandbox.auth0-extend.com';
    this.authorizationServer = config.authorizationServer;
    this.audience = config.audience;
    this.clientId = config.clientId;
    this.refreshToken = config.refreshToken;
}

// Discover whether WT deployment supports auth v2 and if so create
// UserAuthenticator instance for it
UserAuthenticator.create = function (sandboxUrl, auth0) {
    // we are defaulting to AUTHv2 here, we can revert to AUTHv1 using
    // AUTH_MODE=v1 env var the use of --auth0 switch forces AUTHv2 as well.

    if (process.env.AUTH_MODE === 'v1' && !auth0) return Promise.resolve(null);

    var descriptionUrl = Url.parse(sandboxUrl);
    descriptionUrl.pathname = '/api/description';
    let request = Superagent
        .get(Url.format(descriptionUrl))

    const proxy = process.env.http_proxy || process.env.HTTP_PROXY;
    if (proxy) {
        request = request.proxy(proxy);
    }

    return request
        .ok(res => res.status < 500)
        .then(res => {
            if (res.status === 200 && res.body && res.body.authorization_server) {
                return new UserAuthenticator({
                    sandboxUrl,
                    authorizationServer: res.body.authorization_server,
                    audience: res.body.audience || sandboxUrl,
                    clientId: res.body.client_id,
                });
            }
            else {
                return Promise.resolve(null);
            }
        });
};

UserAuthenticator.prototype.login = function (options) {
    options = options || {};

    if (this.refreshToken) {
        return this._refreshFlow(options);
    }
    else {
        return this._authorizationFlow(options);
    }
};

// Refresh token flow
UserAuthenticator.prototype._refreshFlow = function (options) {
    var refreshUrl = Url.parse(this.authorizationServer);
    refreshUrl.pathname = '/oauth/token';
    var self = this;

    let request = Superagent
        .post(Url.format(refreshUrl))

    const proxy = process.env.http_proxy || process.env.HTTP_PROXY;
    if (proxy) {
        request = request.proxy(proxy);
    }

    return request
        .send({
            grant_type: 'refresh_token',
            client_id: this.clientId,
            refresh_token: this.refreshToken,
        })
        .then(res => {
            console.log('Your access token was successfuly refreshed.');
            return self._processAccessTokenResponse(options, res.body, options.requestedScopes);
        })
        .catch(e => {
            // In case of any error during refresh token flow, fall back on
            // regular authorization flow
            console.log(`Failure trying to refresh the access token: ${e.message}`);
            return self._authorizationFlow(options);
        });
};

// Browser based authorization flow
UserAuthenticator.prototype._authorizationFlow =  function (options) {
    // Initialize PKCE authorization flow through a browser

    var self = this;
    var codeVerifier = base64URLEncode(Crypto.randomBytes(16));
    var codeChallange = base64URLEncode(Crypto.createHash('sha256').update(codeVerifier).digest());
    var port = 8722 + Math.floor(6 * Math.random());
    var redirectUri = `http://127.0.0.1:${port}`;
    var requestedScopes = [ 'openid', 'offline_access' ];
    var audience;
    if (options.auth0) {
        audience = Url.parse(self.audience || self.sandboxUrl);
        audience.pathname += '/containers/' + options.container;
        audience = Url.format(audience);
        requestedScopes.push('wt:owner');
    }
    else {
        audience = self.audience || self.sandboxUrl;
        if (options.container) {
            requestedScopes.push(`wt:owner:${options.container}`);
        }
        if (options.admin) {
            requestedScopes.push(`wt:admin`);
        }
    }
    requestedScopes = requestedScopes.join(' ');

    var onceServer$ = createOnceServer();
    var loginUrl = createLoginUrl();

    console.log('Attempting to open the following login url in your browser: ');
    console.log();
    console.log(Chalk.underline(loginUrl));
    console.log();
    console.log('If the browser does not automatically open, please copy this address and paste it into your browser.');

    Open(loginUrl, { wait: false });

    return onceServer$;

    // Create PKCE login URL
    function createLoginUrl() {
        var loginUrl = Url.parse(self.authorizationServer, true);
        loginUrl.pathname = '/authorize';
        loginUrl.query = {
            redirect_uri: redirectUri,
            audience: audience,
            response_type: 'code',
            client_id: self.clientId,
            scope: requestedScopes,
            code_challenge: codeChallange,
            code_challenge_method: 'S256',
        };

        return Url.format(loginUrl);
    }

    // Returns a promise that resolves when a transient, localhost HTTP server
    // receives the first request. This request is a redirect from the authorization server.
    function createOnceServer() {
        return new Promise((resolve, reject) => {
            var server = Http.createServer((req, res) => {

                return processRedirectCallback(req, done);

                var _done;
                function done(error, data) {
                    if (_done) return;
                    _done = true;
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    if (error) {
                        res.end(error.message);
                    }
                    else {
                        res.end('Authentication successful.');
                    }
                    server.close();
                    return error ? reject(error) : resolve(data);
                }
            }).listen(port, (e) => {
                if (e) reject(e);
            });
        });
    }

    // Process redirect from authorization server to get authorization code
    function processRedirectCallback(req, done) {
        var url = Url.parse(req.url, true);
        if (req.method !== 'GET' || url.pathname !== '/') {
            return done(new Error(`Authentication failed. Invalid redirect from authorization server: ${req.method} ${req.url}`));
        }

        if (url.query.error) {
            return done(new Error(`Authentication failed: ${url.query.error}.`));
        }
        if (!url.query.code) {
            return done(new Error(`Authentication failed. Authorization server response does not specify authorization code: ${req.url}.`));
        }

        return exchangeAuthorizationCode(url.query.code, done);
    }

    // Exchange authorization code for access token using PKCE
    function exchangeAuthorizationCode(code, done) {
        var tokenUrl = Url.parse(self.authorizationServer);
        tokenUrl.pathname = '/oauth/token';

        let request = Superagent
            .post(Url.format(tokenUrl))

        const proxy = process.env.http_proxy || process.env.HTTP_PROXY;
        if (proxy) {
            request = request.proxy(proxy);
        }

        return request
            .send({
                grant_type: 'authorization_code',
                client_id: self.clientId,
                code,
                code_verifier: codeVerifier,
                redirect_uri: redirectUri
            })
            .end((e,r) => {
                if (e) return done(new Error(`Authentication failed. Unable to obtian access token: ${e.message}.`));
                return self._processAccessTokenResponse(options, r.body, requestedScopes, done);
            });
    }

};

// Prepare wt-cli profile from rewfresh token or authorization code exchange response
UserAuthenticator.prototype._processAccessTokenResponse = function(options, body, requestedScopes, done) {
    var scopes = (body.scope || requestedScopes).split(' ');
    body.scopes = scopes;
    var isAdmin = scopes.indexOf('wt:admin') > -1;
    var container;
    if (options.container) {
        if (isAdmin || scopes.indexOf(`wt:owner:${options.container}`) > -1 || scopes.indexOf('wt:owner') > -1) {
            container = options.container;
        }
        else {
            return done(new Error(`Authentication failed: user does not have permissions to container '${options.container}'.`));
        }
    }
    else {
        if (isAdmin) {
            container = 'master';
        }
        else {
            scopes.forEach(s => {
                var match = s.match(/^wt\:owner\:(.+)$/);
                if (match && !container) {
                    container = match[1];
                }
            });
            if (!container) {
                return done(new Error(`Authentication failed: user has no permissions in the system.`));
            }
        }
    }

    var profile = Sandbox.init({
        url: this.sandboxUrl,
        token: body.access_token,
        container: container,
    });
    profile.name = options.profileName;
    profile.openid = body;
    if (profile.openid.expires_in) {
        profile.openid.valid_until = new Date(Date.now() + +profile.openid.expires_in * 1000).toString();
    }
    profile.openid.authorization_server = this.authorizationServer;
    profile.openid.audience = this.audience;
    profile.openid.client_id = this.clientId;
    profile.openid.refresh_token = profile.openid.refresh_token || this.refreshToken;
    profile.openid.auth0 = options.auth0;

    return done ? done(null, profile) : profile;
};

function base64URLEncode(str) {
    return str.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}
