var Bluebird = require('bluebird');
var Bundler = require('webtask-bundle');
var Chalk = require('chalk');
var Cli = require('structured-cli');
var Concat = require('concat-stream');
var ConfigFile = require('../lib/config');
var Fs = Bluebird.promisifyAll(require('fs'));
var Logs = require('../lib/logs');
var Path = require('path');
var Sandbox = require('sandboxjs');
var Superagent = require('superagent');
var Watcher = require('filewatcher');
var WebtaskCreator = require('../lib/webtaskCreator');
var _ = require('lodash');


module.exports = Cli.createCommand('create', {
    description: 'Get information about an existing webtask profile',
    handler: handleCreate,
    options: {
        profile: {
            alias: 'p',
            description: 'Profile to inspect',
            type: 'string',
        },
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
        // parse: {
        //     description: 'Expose the parsed payload as `body` on the webtask context object',
        //     type: 'boolean',
        // },
        // merge: {
        //     description: 'Merge secrets, query parameters, and parsed body into the `data` field of the webtask context object',
        //     type: 'boolean',
        // },
        capture: {
            description: 'Download and use the current code indicated by `url`',
            type: 'boolean',
        },
    },
    params: {
        'file_or_url': {
            description: 'Path or URL of the webtask\'s code (otherwise reads from stdin)',
            type: 'string',
        },
    },
});


// Command handler

function handleCreate(args) {
    if (args.capture && args.watch) {
        throw Cli.error.invalid('--watch is incompatible with --capture');
    }
    
    if (args.capture && args.bundle) {
        throw Cli.error.invalid('--bundle is incompatible with --capture');
    }
    
    if (args.loose && !args.bundle) {
        throw Cli.error.invalid('--bundle-loose can only be passed with --bundle');
    }
    
    if (!args.file_or_url && args.bundle) {
        throw Cli.error.invalid('--bundle can not be used when reading from `stdin`');
    }
    
    if (!args.file_or_url && args.watch) {
        throw Cli.error.invalid('--watch can not be used when reading from `stdin`');
    }
    
    var fileOrUrl = args.file_or_url;
    
    if (fileOrUrl && fileOrUrl.match(/^https?:\/\//i)) {
        if (args.watch) {
            throw Cli.error.invalid('The --watch option can only be used '
                + 'when a file name is specified');
        }
        
        if (args.bundle && !args.capture) {
            throw Cli.error.invalid('The --bundle option can only be used '
                + 'when a file name is specified');
        }
        
        args.source = 'url';
        args.spec = fileOrUrl;
    } else if (fileOrUrl) {
        if (args.capture) {
            throw Cli.error.invalid('The --capture option can only be used '
            + 'when a url is specified');
        }
        
        args.source = 'file';
        args.spec = Path.resolve(process.cwd(), fileOrUrl);
    } else {
        args.source = 'stdin';
        args.spec = process.cwd();
    }
    
    if (!args.name) {
        // The md5 approach is here for redundancy, but in practice, it seems
        // that Path.basename() will resolve to something intelligent all the
        // time.
        args.name = Path.basename(args.spec, Path.extname(args.spec)) || require('crypto')
            .createHash('md5')
            .update(args.spec)
            .digest('hex');
    }
    
    switch (args.type) {
        case 'function':
            args.merge = true;
            args.parse = true;
            break;
        case 'stream':
        case 'express':
            args.merge = true;
            args.parse = false;
            break;
    }
    
    parseKeyValList(args, 'secrets');
    
    var config = new ConfigFile();

    return config.getProfile(args.profile)
        .then(onProfile);
        
    
    function onProfile(profile) {
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
}


function parseKeyValList(args, field) {
    args[field] = _.reduce(args[field], function (acc, entry) {
        var parts = entry.split('=');
        
        return _.set(acc, parts.shift(), parts.join('='));
    }, {});
}
