var Chalk = require('chalk');
var Cli = require('structured-cli');
var CreateWebtask = require('../lib/createWebtask');
var ValidateCreateArgs = require('../lib/validateCreateArgs');


module.exports = Cli.createCommand('create', {
    description: 'Create and update webtasks',
    plugins: [
        require('./_plugins/profile'),
    ],
    optionGroups: {
        'Output options': {
            output: {
                alias: 'o',
                description: 'Set the output format',
                choices: ['json'],
                type: 'string',
            },
            'show-token': {
                description: 'Show tokens (hidden by default)',
                dest: 'showToken',
                type: 'boolean',
            },
        },
        'Webtask creation': {
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
            'param': {
                action: 'append',
                defaultValue: [],
                description: 'Param(s) exposed to your code as `params` on the webtask context object. The properties will be signed and protected from interference but not encrypted.',
                dest: 'params',
                metavar: 'KEY=VALUE',
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
            'meta-file': {
                description: 'A file containing one meta per line in KEY=VALUE format',
                dest: 'metaFile',
                metavar: 'FILENAME',
                type: 'string',
            },
            'name': {
                alias: 'n',
                description: 'Name of the webtask. When specified, the resulting webtask token can be run at a special named webtask url and additional path segments are allowed (/api/run/{container}/{name}/*). This is important when using `webtask-tools` to expose an Express server as a webtask.',
                type: 'string'
            },
            'dependency': {
                action: 'append',
                alias: 'd',
                defaultValue: [],
                description: 'Specify a dependency on a node module. The best matching version of this node module (at the time of webtask creation) will be available in your webtask code via `require()`. You can use this option more than once to add mutliple dependencies.',
                dest: 'dependencies',
                metavar: 'NAME@VERSION',
                type: 'string',
            },
            'ignore-package-json': {
                description: 'Ignore any dependencies found in a package.json file adjacent to your webtask.',
                dest: 'ignorePackageJson',
                type: 'boolean',
            },
            'middleware': {
                action: 'append',
                defaultValue: [],
                description: 'Specify a webtask middleware that should be run prior to (or in lieu of) your underlying webtask code. Middleware specified in this way will automatically be added as dependencies. Use of middleware implies the @webtask/middleware-compiler which will also automatically be added to dependencies. For more information on middleware, see: https://goo.gl/yh3VAB',
                metavar: 'NAME@VERSION/EXPORT',
                type: 'string',
            },
            'watch': {
                alias: 'w',
                description: 'Automatically watch and reprovision the webtask on local file changes. This will also subscribe you to logs as if you had done `wt logs` to provide an intuitive development experience without requiring multiple active terminals.',
                type: 'boolean',
            },
            'no-merge': {
                action: 'storeFalse',
                defaultValue: true,
                description: 'Disable automatic merging of the parsed body and secrets into the `data` field of the webtask context object. The parsed body (if available) will be on the `body` field and secrets on the `secrets` field.',
                dest: 'merge',
            },
            'no-parse': {
                description: 'Deprecated and ignored.',
                type: 'boolean'
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
            'prod': {
                description: 'Deprecated and ignored.',
                type: 'boolean',
            },
            'host': {
                description: 'Allow the webtask to be called using a custom domain name. Using this option requires proof of domain ownership. This can be done by adding a TXT record type to the DNS of the chosen domain. The value of the record must be `webtask:container:{container}`, where {container} is the webtask container name to be associated with the custom domain. Many such TXT records can be created as needed.',
                type: 'string'
            },
        },
    },
    params: {
        'file_or_url': {
            description: 'Path or URL of the webtask\'s code. When not specified, code will be read from STDIN.',
            type: 'string',
        },
    },
    epilog: Chalk.underline('Sample usage:') + '\n'
        + '1. Create a basic webtask:' + '\n'
        + Chalk.bold('  $ wt create ./sample-webtasks/hello-world.js') + '\n'
        + '\n'
        + '2. Create a webtask with one secret:' + '\n'
        + Chalk.bold('  $ wt create --secret name=webtask ./sample-webtasks/html-response.js') + '\n'
        + '\n'
        + '3. Create a webtask that is bundled before deploying:' + '\n'
        + Chalk.bold('  $ wt create --secret name=webtask --bundle ./sample-webtasks/bundled-webtask.js') + '\n'
    ,
    handler: handleCreate,
});


// Command handler

function handleCreate(args) {
    args = ValidateCreateArgs(args);

    return CreateWebtask(args, { action: 'created' });
}
