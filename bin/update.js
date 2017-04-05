var Cli = require('structured-cli');
var CreateWebtask = require('../lib/createWebtask');
var ValidateCreateArgs = require('../lib/validateCreateArgs');


module.exports = Cli.createCommand('update', {
    description: 'Update the code of a named webtask',
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
            'watch': {
                alias: 'w',
                description: 'Automatically watch and reprovision the webtask on local file changes. This will also subscribe you to logs as if you had done `wt logs` to provide an intuitive development experience without requiring multiple active terminals.',
                type: 'boolean',
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
        'name': {
            description: 'The name of the webtask to update.',
            type: 'string',
            required: true,
        },
        'file_or_url': {
            description: 'Path or URL of the webtask\'s code. When not specified, code will be read from STDIN.',
            type: 'string',
        },
    },
    handler: handleUpdate,
});


// Command handler

function handleUpdate(args) {
    args = ValidateCreateArgs(args);

    var profile = args.profile;

    return profile.inspectWebtask({ name: args.name, decrypt: true, meta: true })
        .then(onClaims);


    function onClaims(claims) {
        // Set the user-defined options from the inspected webtask's claims
        args.merge = claims.mb;
        args.parse = claims.pb;
        args.secrets = claims.ectx;
        args.params = claims.pctx;
        args.meta = claims.meta;

        // Defer to the functionality of the create command
        return CreateWebtask(args, { action: 'updated' });
    }
}


