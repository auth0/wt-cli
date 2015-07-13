var Cli = require('nested-yargs');
var Colors = require('colors');
var Fs = require('fs');
var Path = require('path');
var Watcher = require('filewatcher');
var Webtask = require('../');
var _ = require('lodash');

var tokenOptions = {
    name: {
        alias: 'n',
        description: 'name of the webtask',
        type: 'string'
    },
    secret: {
        alias: 's',
        description: 'secret(s) to provide to code at runtime',
        type: 'string',
    },
    output: {
        alias: 'o',
        description: 'what to output <all|url|token>',
        type: 'string',
        'default': 'url',
    },
    profile: {
        alias: 'p',
        description: 'name of the profile to set up',
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
        description: 'webtask cannot be used before this time',
    },
    exp: {
        description: 'webtask cannot be used after this time',
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
};


module.exports = Cli.createCommand('create', 'Create webtasks.', {
	params: '<file_or_url>',
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
               
                if (['all', 'url', 'token', 'none'].indexOf(argv.output) < 0) {
                    throw new Error('The `output` parameter must be one of: '
                        + '`all`, `url`, `token` or `none`.');
                }
                
                if (argv.nbf) parseDate(argv, 'nbf');
                if (argv.exp) parseDate(argv, 'exp');
                
                if (argv.secret) parseHash(argv, 'secret');
                if (argv.param) parseHash(argv, 'param');
                if (argv.tokenLimit) parseHash(argv, 'tokenLimit');
                if (argv.containerLimit) parseHash(argv, 'containerLimit');


                return true;
            });
    },
	handler: handleCreate
});

function walk(dir, list) {
    var files = Fs.readdirSync(dir);

    if(!list) list = [];

    files.forEach(function (file) {
        var joined    = Path.join(dir, file);
        var fileOrDir = Fs.statSync(joined);


        if(fileOrDir.isDirectory()) walk(joined, list);
        else                        list.push(joined);
    });

    return list;
}

function handleCreate (argv) {
    var fileOrUrl = argv.params.file_or_url;
    var fol = fileOrUrl.toLowerCase();

    if (fol.indexOf('http://') === 0 || fol.indexOf('https://') === 0) {
        argv.code_url = fileOrUrl;

        if (argv.watch) {
            throw new Error('The --watch option can only be used '
                + 'when a file name is specified.');
        }
    } else {
        argv.file_name = Path.resolve(process.cwd(), fileOrUrl);
        
        try {
            var fileOrDirectory = Fs.lstatSync(argv.file_name);

            if(fileOrDirectory.isFile()) {
                argv.code = Fs.readFileSync(argv.file_name, 'utf8');
            } else {
                argv.code = walk(argv.file_name);
            }
        } catch (e) {
            throw new Error('Unable to read the file `'
                + argv.file_name + '`.');
        }
    }
    
    argv.merge = typeof argv.merge === 'undefined' ? true : !!argv.merge;
    argv.parse = typeof argv.parse === 'undefined' ? true : !!argv.parse;

    function createWebtask(pathToCode) {
        var generation = 0;
        var code       = Fs.readFileSync(pathToCode).toString();

        var pending = createToken(code);

        if (argv.watch) {
            var watcher = Watcher();

            watcher.add(pathToCode);

            watcher.on('change', function (file, stat) {
                generation++;

                if (!argv.json) {
                    console.log('File change detected, creating generation'
                    , generation);
                }

                code = Fs.readFileSync(pathToCode, 'utf8');

                pending = pending
                    .then(createToken.bind({}, code));
            });

            return pending;
        }
    }

    if(argv.code instanceof Array) {
        return argv.code
            .forEach(createWebtask);
    } else {
        return createWebtask(argv.code);
    }

    
    function createToken (code) {
        var config = Webtask.configFile();

        var createTokenOptions = _.merge({}, argv, parseLocalConfig(argv.name), { code: code });

        return config.load()
            .then(function (profiles) {
                if (_.isEmpty(profiles)) {
                    throw new Error('You must create a profile to begin using '
                        + 'this tool: `wt profile init`.');
                }
                
                return config.getProfile(argv.profile);
            })
            .then(function (profile) {
                return profile.createToken(createTokenOptions)
                    .then(function (token) {
                        var result = {
                            token: token,
                            webtask_url: profile.url + '/api/run/'
                                + profile.container + '?key=' + token
                                + '&webtask_no_cache=1',
                        };
                        if (argv.name) {
                            result.named_webtask_url = profile.url
                                + '/api/run/'
                                + profile.container
                                + '/' + argv.name
                                + '?webtask_no_cache=1';
                        }
                        return result;
                    });
            })
            .then(function (data) {
                if (argv.output === 'none') {
                    // Do nothing
                } else if (argv.output === 'token') {
                    console.log(argv.json
                        ? JSON.stringify(data.token)
                        : data.token);
                } else if (argv.output === 'url') {
                    console.log(argv.json
                        ? JSON.stringify(data.named_webtask_url || data.webtask_url)
                        : (data.named_webtask_url || data.webtask_url));
                } else if (argv.json) {
                    console.log(data);
                } else {
                    console.log('Webtask token:'.green);
                    console.log(data.token);
                    console.log('Webtask URL:'.green);
                    console.log(data.webtask_url);
                    if (data.named_webtask_url) {
                        console.log('Named webtask URL:'.green);
                        console.log(data.named_webtask_url);
                    }
                }
                
                return data;
            });
    }
}

function parseDate (argv, field) {
    var value = argv[field];
    var date = (value[0] === '+')
        ? Date.now() + parseInt(value.substring(1), 10) * 60 * 1000
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

//
// Load params and secrets from local config files (package.json & .env)
//

function getParamsFromConfig(obj) {
    var params = {};

    Object
        .keys(obj)
        .forEach(function (key) {
             params[key] = obj[key];
        });

    return params;
}

function getSecretsFromConfig(array) {
    var secrets = {};

    var dotEnv;

    try {
        dotEnv = Fs.readFileSync('./.env');
    } catch(e) {
        throw new Error('Secrets must be specified in a .env file, eg: SECRET="shhh"');
    }

    array
        .forEach(function (key) {
            dotEnv
                .toString()
                .split('\n')
                .filter(function (secret) {
                    return secret.length;
                })
                .map(function (secret) {
                    return secret.split('=');
                })
                .forEach(function (secret) {
                    if(secret[0] === key) secrets[key] = secret[1];
                });
        });

    return secrets;
}

function getTasks(config) {
    return Object
        .keys(config)
        .filter(function (key) {
            return key !== 'global';
        });
}

function parseLocalConfig (taskName) {
    var options = {
        param:  {},
        secret: {}
    };

    try {
        var configFile = Fs.readFileSync('./package.json');
    } catch(e) {
        return options;
    }

    var config = 
        JSON.parse(
            configFile.toString()
        )
        .webtasks;

    if(!config) return;

    // Global params and secrets for every task
    if(config.global) {
            if(config.global.params)
                _.assign(options.param, getParamsFromConfig(config.global.params));

            if(config.global.secrets)
                _.assign(options.secret, getSecretsFromConfig(config.global.secrets));
    }

    // Per-task
    getTasks(config)
        .forEach(function (key) {
            if(key === taskName) {
                if(config[key].params)
                    _.assign(options.param, getParamsFromConfig(config[key].params));

                if(config[key].secrets)
                    _.assign(options.secret, getSecretsFromConfig(config[key].secrets));
            }
        });

    return options;

}
