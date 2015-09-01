var Babel = require('babel');
var Bluebird = require('bluebird');
var Cli = require('nested-yargs');
var Colors = require('colors');
var Crypto = require('crypto');
var Fs = Bluebird.promisifyAll(require('fs'));
var Path = require('path');
var Watcher = require('filewatcher');
var Webtask = require('../');
var Wreck = Bluebird.promisifyAll(require('wreck'));
var _ = require('lodash');

var tokenOptions = {
    secret: {
        alias: 's',
        description: 'secret(s) to provide to code at runtime',
        type: 'string',
    },
    output: {
        alias: 'o',
        description: 'what to output <url|token|token-url>',
        type: 'string',
        'default': 'url',
    },
    name: {
        alias: 'n',
        description: 'name of the webtask',
        type: 'string'
    },
    prod: {
        alias: 'r',
        description: 'enable production optimizations',
        type: 'boolean'
    },
    profile: {
        alias: 'p',
        description: 'name of the webtask profile to use',
        'default': 'default',
        type: 'string',
    },
    watch: {
        alias: 'w',
        description: 'watch for file changes',
        type: 'boolean',
    },
    json: {
        alias: 'j',
        description: 'json output',
        type: 'boolean',
    },
    compile: {
        alias: 'C',
        description: 'pre-compile a local file using the indicated library (for now only `babel` is supported and will read `.babelrc` if present)',
        type: 'string',
    },
    advanced: {
        alias: 'a',
        type: 'boolean',
        description: 'show all advanced options when using the `--help` flag',
    },
    help: {
        type: 'boolean',
        description: 'Show help',
    }
};

var advancedTokenOptions = {
    'no-parse': {
        type: 'boolean',
        description: 'prevent the parsing JSON and urlencoded request body',
        'default': false,
    },
    'no-merge': {
        type: 'boolean',
        description: 'prevent the merging of body data into `context.data`',
        'default': false,
    },
    nbf: {
        description: 'webtask cannot be used before this time (use +N to indicate \'N\' minutes from now)',
        type: 'string',
    },
    exp: {
        description: 'webtask cannot be used after this time (use +N to indicate \'N\' minutes from now)',
        type: 'string',
    },
    'self-revoke': {
        description: 'allow the webtask token to revoke itself',
        type: 'boolean',
        'default': true,
    },
    'issuance-depth': {
        description: 'max depth of issuance chain for new token',
        type: 'number',
        'default': 0,
    },
    param: {
        description: 'nonsecret param(s) to provide to code at runtime',
        type: 'string',
    },
    container: {
        alias: 'c',
        description: 'webtask container where the job will run',
        type: 'string',
    },
    capture: {
        description: 'download and use the current code indicated by `url`',
        type: 'boolean',
    },
    cluster_url: {
        description: 'the webtask cluster url provided in lieu of a profile',
        type: 'string',
    },
    token: {
        description: 'the webtask token provided in lieu of a profile',
        type: 'string',
    },
    jti: {
        description: 'specify the json token id that will bused',
        type: 'string',
    },
};


module.exports = Cli.createCommand('create', 'Create webtasks', {
	params: '<file_or_url>',
	examples: {
	  'create a webtask named "foo"': '$0 create --name foo file.js',
	  'create an express-based webtask named "express"': '$0 create --no-parse --no-merge --name express file.js',
	},
	setup: function (yargs) {
        // We want to only show advanced options if requested or if at least one
        // is already being used (that is not also a basic option)
        if (yargs.argv.advanced || yargs.argv.a
            || _.findKey(yargs.argv, function (val, key) {
                return (advancedTokenOptions[key]
                    || (advancedTokenOptions['no-' + key])
                        && (!tokenOptions[key] || !tokenOptions['no-' + key])
                    || _.find(advancedTokenOptions, {alias: key}));
        })) {
            _.extend(tokenOptions, advancedTokenOptions);

            // We have detected advanced options, turn on advanced to signal
            // advanced mode to handler
            yargs.argv.advanced = true;
        }

        yargs
            .options(tokenOptions)
            .check(function (argv) {
                if (argv.issuanceDepth
                    && (Math.floor(argv.issuanceDepth) !== argv.issuanceDepth
                    || argv.issuanceDepth < 0)) {

                    throw Cli.usageError('The `issuance-depth` parameter must be a '
                        + 'non-negative integer.');
                }
                
                if (['url', 'token', 'token-url', 'none'].indexOf(argv.output) < 0) {
                    throw Cli.usageError('The `output` parameter must be one of: '
                        + '`url`, `token`, `token-url` or `none`.');
                }
                
                if (argv.nbf) parseDate(argv, 'nbf');
                if (argv.exp) parseDate(argv, 'exp');
                
                if (argv.secret) parseHash(argv, 'secret');
                if (argv.param) parseHash(argv, 'param');
                if (argv.tokenLimit) parseHash(argv, 'tokenLimit');
                if (argv.containerLimit) parseHash(argv, 'containerLimit');

                if (argv.watch && argv.json) {
                    throw Cli.usageError('The --watch flag can not be enabled at the same time '
                        + 'as the --json flag.');
                }
                
                if (argv.cluster_url || argv.token) {
                    if (argv.profile !== tokenOptions.profile.default) {
                        throw Cli.usageError('The --profile option cannot be '
                            + 'combined with either --cluster_url or --token.');
                    } else if (!argv.container) {
                        throw Cli.usageError('The --container option must be '
                            + 'specified with the --cluster_url and --token '
                            + 'options.');
                    }
                }

                return true;
            });
    },
	handler: handleCreate
});

function handleCreate (argv) {
    var fileOrUrl = argv.params.file_or_url;
    var fol = fileOrUrl.toLowerCase();
    var useBabelRx = /^[\n\s]*(\"|\')use\s+latest\1\s*(?:;|\n)/;
    
    if (fol.indexOf('http://') === 0 || fol.indexOf('https://') === 0) {
        if (argv.watch) {
            throw Cli.usageError('The --watch option can only be used '
                + 'when a file name is specified.');
        }
        
        if (argv.compile && !argv.capture) {
            throw Cli.usageError('The --compile option can only be used '
                + 'when a file name is specified or when --capture is used '
                + 'with a url.');
        }
        
        argv.code_url = fileOrUrl;
    } else {
        if (argv.capture) {
            throw Cli.usageError('The --capture option can only be used '
            + 'when a url is specified.');
        }
        
        argv.file_name = Path.resolve(process.cwd(), fileOrUrl);
    }

    if (argv.output === 'url') {
        if (!argv.name) {
            if (argv.file_name) {
                argv.name = Path.basename(fol, Path.extname(fol));
            }
            if (!argv.name) {
                var md5 = Crypto.createHash('md5');
                argv.name = md5.update(fol, 'utf8').digest('hex');
            }
        }
    } else if (argv.name && argv.output !== 'none') {
        // throw Cli.usageError('The `name` option can only be specified when --output is set to `url`.');
    }
    
    argv.merge = typeof argv.merge === 'undefined' ? true : !!argv.merge;
    argv.parse = typeof argv.parse === 'undefined' ? true : !!argv.parse;
    
    return maybeReadCode()
        .then(createToken)
        .finally(maybeWatchCode);
    
    function maybeReadCode () {
        if (!argv.file_name && !argv.capture) return Bluebird.resolve();
        
        var promise = argv.file_name
            ? Bluebird.try(Fs.readFileSync, [argv.file_name, 'utf8'])
            : Wreck.getAsync(argv.code_url)
                .get(1)
                .call('toString', 'utf8');
            
        return promise
            .then(function (code) {
                if (argv.compile === 'babel') {
                    return compileWithBabel(code);
                } else if (argv.compile) {
                    throw Cli.usageError('Unsupported compiler `' + argv.compile + '`. Only '
                        + '`babel` supported at this time.');
                } else {
                    // Support local transformation of "use latest";
                    var matches = code.match(useBabelRx);
                    
                    if (matches) {
                        // Get rid of the "use latest";
                        return compileWithBabel(code);
                    }
                }
                
                return code;
            })
            .then(function (code) {
                // In case we are coming from --capture
                delete argv.code_url;
                
                argv.code = code;
            });
    }
    
    function maybeWatchCode () {
        if (argv.file_name && argv.watch) {
            var generation = 0;
            var watcher = Watcher();
            
            watcher.add(argv.file_name);
            
            watcher.on('change', function () {
                maybeReadCode()
                    .tap(function () {
                        console.log();
                        console.log('%s changed, creating generation %s...'
                        , argv.file_name, ++generation);
                    })
                    .then(createToken);
            });
        }
    }
    
    function compileWithBabel (code) {
        var options = {};
        
        try {
            var babelrc = Fs.readFileSync(Path.join(process.cwd(), '.babelrc'),
                'utf8');
            
            options = _.extend(options, JSON.parse(babelrc));
        } catch (__) {}
        
        code = code.replace(useBabelRx, '');
        
        return Babel.transform(code, options).code;
    }
    
    function createToken () {
        var config = Webtask.configFile();
        var firstTime = false;
        var profileData = {
            url: argv.cluster_url,
            container: argv.container,
            token: argv.token,
        };
        var promise = argv.cluster_url && argv.token && argv.container
            ? Webtask.createProfile(profileData)
            : config.load()
                .then(function (profiles) {
                    if (_.isEmpty(profiles)) {
                        throw Cli.usageError('You must create a profile to begin using '
                            + 'this tool: `wt init`.');
                    }
                    
                    return config.getProfile(argv.profile);
                })
                .then(function (profile) {
                    if(!profile.hasCreated) {
                        firstTime = true;
    
                        return config.setProfile(argv.profile, _.assign(profile, { hasCreated: true }))
                            .then(config.save.bind(config))
                            .then(function () {
                                return profile;
                            })
                            .catch(function (e) {
                                throw Cli.usageError('Unable to save new config: ' + e.message);
                            });
                    } else {
                        return profile;
                    }
                });
        
        return promise
            .then(function (profile) {
                return profile.createToken(argv)
                    .then(function (token) {
                        var result = {
                            token: token,
                            webtask_url: profile.url + '/api/run/'
                                + (argv.container || profile.container)
                                + '?key=' + token
                                + (argv.prod ? '': '&webtask_no_cache=1')
                        };
                        if (argv.name) {
                            result.named_webtask_url = profile.url
                                + '/api/run/'
                                + (argv.container || profile.container)
                                + '/' + argv.name
                                + (argv.prod ? '': '?webtask_no_cache=1');
                        }
                        return result;
                    });
            })
            .then(function (data) {
                if (argv.output === 'token') {
                    console.log(argv.json
                        ? JSON.stringify(data.token)
                        : data.token);
                } else if (argv.output === 'url') {
                    console.log(argv.json
                        ? JSON.stringify(data.named_webtask_url)
                        : data.named_webtask_url);
                } else if (argv.output === 'token-url') {
                    console.log(argv.json
                        ? JSON.stringify(data.webtask_url)
                        : data.webtask_url);
                } else if (argv.json) {
                    console.log(data);
                }

                if (firstTime) {
                    console.log('\nRun your new webtask like so:\n\t$ curl %s'.green,
                        data.named_webtask_url || data.webtask_url);
                }
                
                return data;
            });
    }
}

function parseDate (argv, field) {
    var value = argv[field];
    var date = (value[0] === '+')
        ? new Date(Date.now() + parseInt(value.substring(1), 10) * 60 * 1000)
        : Date.parse(value);
    
    if (isNaN(date)) {
        throw Cli.usageError('Invalid value of `' + field + '`. Use RFC2822 format '
            + '(e.g. Mon, 25 Dec 1995 13:30:00 GMT) or ISO 8601 format '
            + '(e.g. 2011-10-10T14:48:00). You can also say +10 to indicate '
            + '"ten minutes from now".');
    }
    
    argv[field] = Math.floor(date.valueOf() / 1000);
}

function parseHash (argv, field) {
    var param = argv[field];
    
    if (!_.isArray(param)) argv[field] = [param];
    
    argv[field] = _.reduce(argv[field], function (hash, item) {
        var parts = item.split('=');
        var key = parts.shift();
        var value = parts.join('=');
        
        if (!key || !value) throw Cli.usageError('Unsupported ' + field + ' `'
            + value + '`. All ' + field + 's must be in the <key>=<value> '
            + 'format.');
        
        hash[key] = value;
        
        return hash;
    }, {});
}
