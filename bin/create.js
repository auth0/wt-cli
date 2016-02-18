var Cli = require('structured-cli');
var Logs = require('../lib/logs');
var ValidateCreateArgs = require('../lib/validateCreateArgs');
var WebtaskCreator = require('../lib/webtaskCreator');
var _ = require('lodash');


module.exports = Cli.createCommand('create', {
    description: 'Get information about an existing webtask profile',
    plugins: [
        require('./_plugins/profile'),
    ],
    optionGroups: {
        'Webtask creation': {
            secret: {
                action: 'append',
                alias: 's',
                defaultValue: [],
                description: 'Secret(s) exposed to your code as `secrets` on the webtask context object',
                dest: 'secrets',
                metavar: 'KEY=VALUE',
                type: 'string',
            },
            name: {
                alias: 'n',
                description: 'Name of the webtask',
                type: 'string'
            },
            watch: {
                alias: 'w',
                description: 'Watch for file changes and stream logs',
                type: 'boolean',
            },
            type: {
                choices: ['function', 'stream', 'express'],
                description: 'Configure body parsing and merging (default: `%(defaultValue)s`)',
                defaultValue: 'function',
                type: 'string',
            },
            bundle: {
                alias: 'b',
                description: 'Use `webtask-bundle` to bundle your code into a single file',
                type: 'boolean',
            },
            'bundle-loose': {
                description: 'Skip strict semver matching for bundling with `webtask-bundle`',
                dest: 'loose',
                type: 'boolean',
            },
            capture: {
                description: 'Download and use the current code indicated by `url`',
                type: 'boolean',
            },
        },
    },
    params: {
        'file_or_url': {
            description: 'Path or URL of the webtask\'s code (otherwise reads from stdin)',
            type: 'string',
        },
    },
    handler: handleCreate,
});


// Command handler

function handleCreate(args) {
    args = ValidateCreateArgs(args);
    
    var profile = args.profile;
    var createWebtask = WebtaskCreator(args, {
        onGeneration: onGeneration,
    });
    var log = args.watch
        ?   _.bindKey(Logs.createLogStream(profile), 'info')
        :   _.bindKey(console, 'log');

    return createWebtask(profile);
    
    
    function onGeneration(build) {
        args.watch
            ?   log({ generation: build.generation, container: build.webtask.container }, 'Webtask created: %s', build.webtask.url)
            :   log(build.webtask.url);
    }
}


