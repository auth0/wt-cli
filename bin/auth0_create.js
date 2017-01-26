var Chalk = require('chalk');
var Cli = require('structured-cli');
var CreateWebtask = require('../lib/createWebtask');
var ValidateCreateArgs = require('../lib/validateCreateArgs');
var Crypto = require('crypto');


module.exports = function (extensionName) {
    return Cli.createCommand('create', {
        description: 'Create or update Auth0 Hook',
        plugins: [
            require('./_plugins/profile'),
        ],
        optionGroups: {
            'Extension creation': {
                'secret': {
                    action: 'append',
                    alias: 's',
                    defaultValue: [],
                    description: 'Secret(s) exposed to your code as `secrets` on the webtask context object. These secrets will be encrypted and stored in a webtask token in such a way that only the webtask server is able to decrypt the secrets so that they may be exposed to your running webtask code.',
                    dest: 'secrets',
                    metavar: 'KEY=VALUE',
                    type: 'string',
                },
                'secrets-file': {
                    description: 'A file containing one secret per line in KEY=VALUE format',
                    dest: 'secretsFile',
                    metavar: 'FILENAME',
                    type: 'string',
                },
                'meta': {
                    action: 'append',
                    defaultValue: [],
                    description: 'Metadata describing the webtask. This is a set of string key value pairs.',
                    dest: 'meta',
                    metavar: 'KEY=VALUE',
                    type: 'string',
                },
                'name': {
                    alias: 'n',
                    description: 'Name of the webtask. When specified, the resulting webtask token can be run at a special named webtask url and additional path segments are allowed (/api/run/{container}/{name}/*). This is important when using `webtask-tools` to expose an Express server as a webtask.',
                    type: 'string'
                },
                'parse-body': {
                    description: 'Automatically parse JSON and application/x-www-form-urlencoded request bodies. Use this with (ctx, req, res) webtask signatures if you want webtask runtime to parse the request body and store it in ctx.body.',
                    type: 'boolean',
                    dest: 'parseBody'
                },
                'bundle': {
                    alias: 'b',
                    description: 'Use `webtask-bundle` to bundle your code into a single file. This tool can compile ES2015 (ES6) code via Babel as well as packaging up a webtask composed of multiple files into a single file. The tool will scan your package.json for dependencies and will automatically bundle those that are not available on the webtask platform. Enabling --bundle-loose will prevent this check from doing strict semver range comparisons on dependencies.',
                    type: 'boolean',
                },
                'bundle-minify': {
                    description: 'Generate a minified production build',
                    type: 'boolean',
                    dest: 'minify'
                },
                'bundle-strict': {
                    description: 'Enforce strict semver matching for bundling with `webtask-bundle`',
                    dest: 'loose',
                    action: 'storeFalse',
                    defaultValue: true,
                    type: 'boolean',
                },
                'capture': {
                    description: 'Download and use the current code indicated by `url`. When you are developing a webtask whose code is remotely hosted, this option will automatically download the remote code before creating the webtask. This means that the webtask will continue to run even if the remote url becomes unavailable.',
                    type: 'boolean',
                },
            },
        },
        params: {
            'file_or_url': {
                description: 'Path or URL of the extension\'s code. When not specified, code will be read from STDIN.',
                type: 'string',
            },
        },
        handler: createHandleCreate(extensionName),
    });
};

// Command handler

function createHandleCreate(extensionName) {
    return function handleCreate(args) {
        args = ValidateCreateArgs(args);
        var profile = args.profile;

        return profile.inspectWebtask({ 
            name: args.name, 
            meta: true 
        })
        .then(function (claims) {
            if (!claims.meta || claims['auth0-extension'] !== 'runtime')
                throw Cli.error.invalid('Webtask ' + args.name + ' exists but is not an Auth0 hook. Please specify a different name using --name parameter.');
            if (claims['auth0-extension-name'] !== extensionName)
                throw Cli.error.invalid('Auth0 hook ' + args.name + ' exists but is of type ' + claims.meta['auth0-extension-name'] + '. Please specify a different name using --name parameter to avoid a conflict.');
            return _create();
        })
        .catch(function (e) {
            if (e && e.statusCode !== 404) {
                throw e;
            }
            return _create();
        });

        function _create() {
            args.params = [];
            args.meta['auth0-extension'] = 'runtime';
            args.meta['auth0-extension-name'] = extensionName;
            args.meta['auth0-extension-disabled'] = '1';
            if (!args.meta['wt-compiler'])
                args.meta['wt-compiler'] = require('./auth0_extensions')[extensionName].compiler;
            var authSecret = Crypto.randomBytes(32).toString('hex');
            args.meta['auth0-extension-secret'] = authSecret;
            args.secrets['auth0-extension-secret'] = authSecret;

            return CreateWebtask(args, { 
                action: 'created', 
                onOutput: function (log, build, url) {
                    log(Chalk.green('Auth0 hook created in disabled state.') + ' To enable this hook to run in production, call:\n\n'
                        + Chalk.green('$ auth0 ' + extensionName + ' enable ' + args.name));
                } 
            });
        }
    }
}
