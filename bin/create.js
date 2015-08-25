var Babel = require('babel');
var Cli = require('nested-yargs');
var Colors = require('colors');
var Crypto = require('crypto');
var Fs = require('fs');
var GetTaskConfig = require('./utils/getTaskConfig');
var Livereload = require('livereload');
var Path = require('path');
var Watcher = require('filewatcher');
var Webtask = require('../');
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
    nolivereload: {
      alias: 'N',
      description: 'disable livereload',
      type: 'boolean'
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
                return (advancedTokenOptions[key] || advancedTokenOptions['no-' + key])
                    && (!tokenOptions[key] || !tokenOptions['no-' + key]);
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

                    throw new Error('The `issuance-depth` parameter must be a '
                        + 'non-negative integer.');
                }
                
                if (['url', 'token', 'token-url', 'none'].indexOf(argv.output) < 0) {
                    throw new Error('The `output` parameter must be one of: '
                        + '`url`, `token`, `token-url` or `none`.');
                }
                
                if (argv.nbf) parseDate(argv, 'nbf');
                if (argv.exp) parseDate(argv, 'exp');
                
                if (argv.secret) parseHash(argv, 'secret');
                if (argv.param) parseHash(argv, 'param');
                if (argv.tokenLimit) parseHash(argv, 'tokenLimit');
                if (argv.containerLimit) parseHash(argv, 'containerLimit');

                if (argv.watch && argv.json) {
                    throw new Error('The `watch` flag can not be enabled at the same time '
                        + 'as the `json` flag.');
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
        argv.code_url = fileOrUrl;

        if (argv.watch) {
            throw new Error('The --watch option can only be used '
                + 'when a file name is specified.');
        }
        
        if (argv.compile) {
            throw new Error('The --compile option can only be used '
                + 'when a file name is specified.');
        }
    } else {
        argv.file_name = Path.resolve(process.cwd(), fileOrUrl);
        
        try {
            argv.code = Fs.readFileSync(argv.file_name, 'utf8');
        } catch (e) {
            throw new Error('Unable to read the file `'
                + argv.file_name + '`.');
        }
        
        if (argv.compile === 'babel') {
            argv.code = compileWithBabel(argv.code);
        } else if (argv.compile) {
            throw new Error('Unsupported compiler `' + argv.compile + '`. Only '
                + '`babel` supported at this time.');
        } else {
            // Support local transformation of "use latest";
            var matches = argv.code.match(useBabelRx);
            
            if (matches) {
                // Get rid of the "use latest";
                argv.code = compileWithBabel(argv.code);
            }
        }
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
    }
    else if (argv.name && argv.output !== 'none') {
        throw new Error('The `name` option can only be specified when --output is set to `url`.');
    }
    
    argv.merge = typeof argv.merge === 'undefined' ? true : !!argv.merge;
    argv.parse = typeof argv.parse === 'undefined' ? true : !!argv.parse;

    return createWebtask(argv.file_name);
    
    function createWebtask (pathToCode) {
        var generation = 0;
        var code = Fs.readFileSync(pathToCode, 'utf8');
        var name = Path.basename(pathToCode, '.js');

        var tokenOpts;
        var watcher = Watcher();

        var pending = argv.json
            ? createToken(argv)
            : GetTaskConfig(argv, code)
                .then(function (taskConfig) {
                    tokenOpts = _.merge({}, argv, taskConfig, { code: code, name: name });
    
                    if(argv.watch) {
                        addListeners();
                    }
    
                    return createToken(tokenOpts);
                });

        function addListeners () {
            watcher.add(pathToCode);
            watcher.add('./.env');
        }

        if (argv.watch) {
            // There should not be any output except that specified by --output
            // when the --json flag is enabled.
            if(!argv.nolivereload) {
                var reloadServer = Livereload.createServer();
                console.log('Livereload server listening: http://livereload.com/extensions\n');
            }

            watcher.on('change', function (file) {
                watcher.removeAll();

                pending = pending
                    .then(function () {
                        code = Fs.readFileSync(pathToCode, 'utf8');

                        return GetTaskConfig(tokenOpts, code);
                    })
                    .then(function (taskConfig) {
                        addListeners();

                        generation++;


                        if (!argv.json) {
                            console.log('%s changed, creating generation %s'
                            , name, generation);
                        }


                        tokenOpts = _.merge({}, argv, taskConfig, { code: code, name: name });

                        return createToken(tokenOpts);
                    })
                    .tap(function () {
                        if(!argv.nolivereload)
                            reloadServer.refresh(argv.file_name);
                    });
            });
        }

        return pending;
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
    
    function createToken (tokenOpts) {
        var config = Webtask.configFile();
        var firstTime = false;

        return config.load()
            .then(function (profiles) {
                if (_.isEmpty(profiles)) {
                    throw new Error('You must create a profile to begin using '
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
                            throw new Error('Unable to save new config: ' + e.message);
                        });
                } else {
                    return profile;
                }
            })
            .then(function (profile) {
                return profile.createToken(tokenOpts)
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
        throw new Error('Invalid value of `' + field + '`. Use RFC2822 format '
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
        
        if (!key || !value) throw new Error('Unsupported ' + field + ' `'
            + value + '`. All ' + field + 's must be in the <key>=<value> '
            + 'format.');
        
        hash[key] = value;
        
        return hash;
    }, {});
}
