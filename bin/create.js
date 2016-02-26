var Chalk = require('chalk');
var Cli = require('structured-cli');
var Logs = require('../lib/logs');
var ValidateCreateArgs = require('../lib/validateCreateArgs');
var WebtaskCreator = require('../lib/webtaskCreator');
var Url = require('url');
var _ = require('lodash');


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
            'name': {
                alias: 'n',
                description: 'Name of the webtask. When specified, the resulting webtask token can be run at a special named webtask url and additional path segments are allowed (/api/run/{container}/{name}/*). This is important when using `webtask-tools` to expose an Express server as a webtask.',
                type: 'string'
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
                action: 'storeFalse',
                defaultValue: true,
                description: 'Disable automatic parsing of the incoming request body. Important: when using webtask-tools with Express and the body-parser middleware, automatic body parsing must be disabled.',
                dest: 'parse',
            },
            'bundle': {
                alias: 'b',
                description: 'Use `webtask-bundle` to bundle your code into a single file. This tool can compile ES2015 (ES6) code via Babel as well as packaging up a webtask composed of multiple files into a single file. The tool will scan your package.json for dependencies and will automatically bundle those that are not available on the webtask platform. Enabling --bundle-loose will prevent this check from doing strict semver range comparisons on dependencies.',
                type: 'boolean',
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
                description: 'Allow the webtask server to cache code. When disabled, your code will be loaded on each request by the webtask runtime environment, introducing additional latency. Leaving this disabled is useful while developing.',
                type: 'boolean',
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
        + '3. Create a webtask that is bundled before deploying. Note that --no-parse is needed since we are using webtask-tools with Express and body-parser:' + '\n'
        + Chalk.bold('  $ wt create --secret name=webtask --bundle --no-parse ./sample-webtasks/bundled-webtask.js') + '\n'
    ,
    handler: handleCreate,
});


// Command handler

function handleCreate(args) {
    args = ValidateCreateArgs(args);
    
    var profile = args.profile;
    var createWebtask = WebtaskCreator(args, {
        onGeneration: onGeneration,
        onError: onError,
    });
    var logger = args.watch
        ?   Logs.createLogStream(profile)
        :   console;
    var log = args.watch
        ?   _.bindKey(logger, 'info')
        :   _.bindKey(logger, 'log');
    var logError = _.bindKey(logger, 'error');

    return createWebtask(profile);
    
    
    function onError(build) {
        formatError(build);
    }
    
    function onGeneration(build) {
        var parsedUrl = Url.parse(build.webtask.url, true);
        
        if (!args.prod) {
            parsedUrl.query.webtask_no_cache = 1;
        }
        
        var url = Url.format(parsedUrl);
        
        formatOutput(build, url);
    }
    
    function formatError(build, url) {
        var output;
        
        if (args.watch) {
            output = { generation: build.generation };
            
            _.forEach(build.stats.errors, function (error) {
                logError(output, 'Bundling failed: %s', error);
            });
        } else if (args.output === 'json') {
            output = { url: url, name: build.webtask.claims.jtn, container: build.webtas.container };
            
            if (args.showToken) {
                output.token = build.webtask.token;
            }
            
            logError(JSON.stringify(build.stats.errors, null, 2));
        } else {
            logError(Chalk.red('Bundling failed failed'));
            build.stats.errors.forEach(logError);
        }
    }
    
    function formatOutput(build, url) {
        var output;
        
        if (args.watch) {
            output = { generation: build.generation, container: build.webtask.container };
            
            if (args.showToken) {
                output.token = build.webtask.token;
            }
            
            log(output, 'Webtask created: %s', url);
        } else if (args.output === 'json') {
            output = { url: url, name: build.webtask.claims.jtn, container: build.webtas.container };
            
            if (args.showToken) {
                output.token = build.webtask.token;
            }
            
            log(JSON.stringify(output, null, 2));
        } else if (args.showToken) {
            log(Chalk.green('Webtask token created') + '\n\n%s\n\nYou can access your webtask at the following url:\n\n%s', Chalk.gray(build.webtask.token), Chalk.bold(url));
        } else {
            log(Chalk.green('Webtask created') + '\n\nYou can access your webtask at the following url:\n\n%s', Chalk.bold(url));
        }
    }
}


