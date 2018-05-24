// Perform OAuth2 PKCE flow to obtain access and refresh tokens to webtask.io

const Crypto = require('crypto');
const Url = require('url');
const Http = require('http');
const Superagent = require('superagent');

function getAccessToken() {
    const codeVerifier = base64URLEncode(Crypto.randomBytes(16));
    const port = 8722 + Math.floor(6 * Math.random());
    const redirectUri = `http://127.0.0.1:${port}`;
    const clientId = '2WvfzGDRwAdovNqHiLY13kAvUDarn4NG';

    // Start local server to receive the callback from the authorization server
    Http.createServer((req, res) => {
        return processRedirectCallback(req, (error, data) => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            let msg = error 
                ? `Authentication failed: ${error.message}` 
                : `Authentication successful:\n\n${JSON.stringify(data, null, 2)}`;
            res.end(msg);
            console.log();
            console.log(msg);
            process.exit(error ? 1 : 0);
        });
    }).listen(port);

    // Create PKCE authorization URL
    let loginUrl = Url.parse('https://webtask.auth0.com/authorize', true);
    loginUrl.query = {
        redirect_uri: redirectUri,
        audience: 'https://sandbox.auth0-extend.com',
        response_type: 'code',
        client_id: clientId,
        scope: 'openid offline_access',
        code_challenge: base64URLEncode(Crypto.createHash('sha256').update(codeVerifier).digest()),
        code_challenge_method: 'S256',
    };
    loginUrl = Url.format(loginUrl);

    return console.log(`Navigate to the following URL in your browser to obtain webtask.io access token:\n\n${loginUrl}`);

    function base64URLEncode(str) {
        return str.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }    

    // Process redirect from authorization server to get authorization code
    function processRedirectCallback(req, cb) {
        var url = Url.parse(req.url, true);
        if (req.method !== 'GET' || url.pathname !== '/') {
            return cb(new Error(`Invalid redirect from authorization server: ${req.method} ${req.url}`));
        }
        if (url.query.error) {
            return cb(new Error(`${url.query.error}: ${url.query.error_description}`));
        }
        if (!url.query.code) {
            return cb(new Error(`Authorization server response does not specify authorization code: ${req.url}.`));
        }

        return exchangeAuthorizationCode(url.query.code, cb);
    }

    // Exchange authorization code for access token using PKCE
    function exchangeAuthorizationCode(code, cb) {
        return Superagent
            .post('https://webtask.auth0.com/oauth/token')
            .send({
                grant_type: 'authorization_code',
                client_id: clientId,
                code,
                code_verifier: codeVerifier,
                redirect_uri: redirectUri
            })
            .end((e, r) => {
                if (e) return cb(new Error(`Authentication failed. Unable to obtian access token: ${e.message}.`));
                return cb(null, r.body)
            });
    }
}

return getAccessToken();
