var Bluebird = require('bluebird');
var Bundler = require('webtask-bundle');
var Chalk = require('chalk');
var Cli = require('../cli');
var Concat = require('concat-stream');
var ConfigFile = require('../lib/config');
var Fs = Bluebird.promisifyAll(require('fs'));
var Logs = require('../lib/logs');
var Path = require('path');
var Sandbox = require('sandboxjs');
var Superagent = require('superagent');
var Watcher = require('filewatcher');
var _ = require('lodash');


module.exports = Cli.command('create', {
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
        .then(createWebtask);
    
    
    function createWebtask(profile) {
        return args.source === 'url'
            ?   createSimpleWebtask(profile)
            :   createLocalWebtask(profile);
    }
    
    function createSimpleWebtask(profile, logger) {
        if (!logger) logger = _.bindKey(console, 'log');
        
        var codeOrUrl$ = args.capture
            ?   Sandbox.issueRequest(Superagent.get(args.spec)).get('text')
            :   args.source === 'stdin'
                ?   readStdin()
                :   Bluebird.resolve(args.spec);
        
        var webtask$ = codeOrUrl$
            .then(function (codeOrUrl) {
                return profile.create(codeOrUrl, {
                    name: args.name,
                    merge: args.merge,
                    parse: args.parse,
                    secrets: args.secrets,
                });
            });
        
        return webtask$
            .then(function (webtask) {
                logger(webtask.url);
            });
        
        
        function readStdin() {
            return new Bluebird(function (resolve, reject) {
                var concat = Concat({ encoding: 'string' }, resolve);
                
                concat.once('error', reject);
                
                process.stdin.pipe(concat);
            });
        }
    }
    
    function createLocalWebtask(profile) {
        return args.bundle
            ?   createBundledWebtask(profile)
            :   createSimpleFileWebtask(profile);
    }
    
    function createBundledWebtask(profile) {
        return new Bluebird(function (resolve, reject) {
            var lastGeneration;
            var logger = args.watch
                ?   _.bindKey(Logs.createLogStream(profile), 'info')
                :   _.bindKey(console, 'log');
            
            Bundler.bundle({
                entry: args.spec,
                loose: args.loose,
                watch: args.watch,
            })
                .subscribe(onGeneration, reject, function () {
                    resolve();
                });
                
            function onGeneration(build) {
                lastGeneration = build.generation;
                
                if (build.stats.errors.length) {
                    return _.forEach(build.stats.errors, logger);
                }
                
                var webtask$ = profile.create(build.code, {
                    name: args.name,
                    merge: args.merge,
                    parse: args.parse,
                    secrets: args.secrets,
                });
                
                webtask$
                    .then(_.partial(onWebtask, lastGeneration), onWebtaskError);
            }
            
            function onWebtask(generation, webtask) {
                if (lastGeneration === generation) {
                    logWebtaskGeneration(logger, generation, webtask);
                }
            }
            
            function onWebtaskError(err) {
                console.log('onWebtaskError', err);
                reject(err);
            }
        });
    }
    
    function createSimpleFileWebtask(profile) {
        return args.watch
            ?   createWatchedFileWebtask(profile)
            :   createSimpleWebtask(profile);
    }
    
    function createWatchedFileWebtask(profile) {
        return new Bluebird(function (resolve, reject) {
            
            var logs = Logs.createLogStream(profile);
            var watcher = Watcher();
            var queue = Bluebird.resolve();
            var generation = 0;
            
            watcher.add(args.spec);
            
            watcher.on('change', onChange);
            watcher.on('error', onError);
            
            onChange();
            
            function onChange() {
                queue = queue.then(function () {
                    var webtask$ = createSimpleWebtask(profile, logger);
                    
                    return webtask$
                        .catch(onError);
    
                    function logger(url) {
                        logs.info('Completed build at generation %d: %s', generation++, url);
                    }
                });
            }
            
            function onError(err) {
                watcher.removeAll();
                
                reject(err);
            }
        });
    }
    
    function logWebtaskGeneration(logger, generation, webtask) {
        args.watch
            ?   logger('Completed build at generation %d: %s', generation, webtask.url)
            :   logger(webtask.url);

    }
}


function parseKeyValList(args, field) {
    args[field] = _.reduce(args[field], function (acc, entry) {
        var parts = entry.split('=');
        
        return _.set(acc, parts.shift(), parts.join('='));
    }, {});
}
