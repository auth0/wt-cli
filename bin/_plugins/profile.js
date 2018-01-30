var Bluebird = require('bluebird');
var Chalk = require('chalk');
var Cli = require('structured-cli');
var ConfigFile = require('../../lib/config');
var Sandbox = require('sandboxjs');
var SuperagentProxy = require('superagent-proxy');
var UserAuthenticator = require('../../lib/userAuthenticator');
var _ = require('lodash');


module.exports = {
    onBeforeConfigure: require('./profileOptions').onBeforeConfigure,
    onBeforeHandler: onBeforeHandler,
};


function onBeforeHandler(context) {
    var args = context.args;

    return sandboxFromArguments(args)
        .then(onProfile);


    function onProfile(profile) {
        args.profile = profile;

        // Ensure V2 access token is fresh enough

        if (!args.profile.openid) return; // V1 webtask token, nothing to do

        // If V2 access token expires in less than 5 mins, get a new one

        var validUntil = new Date(args.profile.openid.valid_until);
        var now = Date.now();
        if ((validUntil - now) < 5 * 60 * 1000) {        
            var userAuthenticator = new UserAuthenticator({ 
                sandboxUrl: args.profile.url,
                authorizationServer: args.profile.openid.authorization_server,
                audience: args.profile.openid.audience,
                clientId: args.profile.openid.client_id,
                refreshToken: args.profile.openid.refresh_token,             
            });

            return userAuthenticator
                .login({ 
                    container: args.profile.container, 
                    admin: args.profile.openid.scopes.indexOf('wt:admin') > -1,
                    profileName: args.profile.name,
                    requestedScopes: args.profile.openid.scope,
                })
                .then(function (profile) {
                    args.profile = profile;
                    var config = new ConfigFile();
                    config.load();
                    return config.setProfile(profile.name, {
                        url: profile.url,
                        token: profile.token,
                        container: profile.container,
                        openid: profile.openid,
                    })
                    .tap(function () {
                        return config.save();
                    });
                });
        }
        else {
            return; // access token still valid more than 5 mins
        }
    }
}

function sandboxFromArguments(args, options) {
    return new Bluebird(function (resolve, reject) {
        if (!options) options = {};

        if (args.token) {
            if (args.profile && !options.allowProfile) return reject(new Cli.error.invalid('--profile should not be specified with custom tokens'));
            if (args.container && args.url) {
                try {
                    return resolve(Sandbox.init({
                        onBeforeRequest,
                        container: args.container,
                        token: args.token,
                        url: args.url,
                    }));
                } catch (e) {
                    return reject(e);
                }
            }
        }

        var config = new ConfigFile();
        var profile$ = config.load()
            .then(loadProfile)
            .then(onProfileLoaded);

        return resolve(profile$);

        function loadProfile(profiles) {
            if (_.isEmpty(profiles)) {
                throw Cli.error.hint('No webtask profiles found. To get started:\n'
                    + Chalk.bold('$ wt init'));
            }

            return config.getProfile(args.profile);
        }

        function onBeforeRequest(request) {
            const proxy = process.env.http_proxy || process.env.HTTP_PROXY;
            const result = proxy
                ?   SuperagentProxy(request, proxy)
                :   request;

            return result;
        }

        function onProfileLoaded(profile) {
            if (args.container) profile.container = args.container;
            if (args.url) profile.url = args.url;
            if (args.token) profile.token = args.token;

            return profile;
        }
    });
}
