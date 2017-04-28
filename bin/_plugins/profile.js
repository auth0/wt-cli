var Bluebird = require('bluebird');
var Chalk = require('chalk');
var Cli = require('structured-cli');
var ConfigFile = require('../../lib/config');
var Sandbox = require('sandboxjs');
var SuperagentProxy = require('superagent-proxy');
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
    }
}

function sandboxFromArguments(args, options) {
    return new Bluebird(function (resolve, reject) {
        if (!options) options = {};

        if (args.token) {
            if (args.profile && !options.allowProfile) return resolve(new Cli.error.invalid('--profile should not be specified with custom tokens'));

            var sandboxOptions = {
                onBeforeRequest,
                url: args.url || 'https://webtask.it.auth0.com',
            };

            if (args.container) sandboxOptions.container = args.container;

            try {
                return resolve(Sandbox.fromToken(args.token, sandboxOptions));
            } catch (e) {
                return reject(e);
            }
        }

        if (args.url) return reject(Cli.error.invalid('--token must be specified with --url'));

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

            return profile;
        }
    });
}
