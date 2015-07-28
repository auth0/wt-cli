var Babel = require('babel');
var Cli = require('nested-yargs');
var Colors = require('colors');
var Crypto = require('crypto');
var Fs = require('fs');
var Livereload = require('livereload');
var Path = require('path');
var Watcher = require('filewatcher');
var Webtask = require('../');
var _ = require('lodash');
var Crypto = require('crypto');
var Jwt = require('jsonwebtoken');
var Dotenv = require('dotenv').load({ silent: true });
var Qs = require('qs');
var Bluebird = require('bluebird');

var SHARED_ACCOUNT_CLIENT_ID = 'ODGT86Z8Sx0e92shNVn9N5H8JNGAh8R9';
var SHARED_ACCOUNT_DOMAIN = 'webtaskme.auth0.com'

var tokenOptions = {
    secret: {
        alias: 's',
        description: 'secret(s) to provide to code at runtime',
        type: 'string',
    },
    param: {
        description: 'nonsecret param(s) to provide to code at runtime',
        type: 'string'
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
    auth0: {
      description: 'set webtask permisions',
      type: 'string'
    },
    share: {
        description: 'generate secure, shareable link',
        type: 'bool',
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
    auth: {
      description: 'set webtask permisions',
      type: 'boolean'
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
    container: {
        alias: 'c',
        description: 'webtask container where the job will run',
        type: 'string',
    },
    clientId: {
        description: 'for custom auth0 account',
        type: 'string'
    },
    clientSecret: {
        description: 'for custom auth0 account',
        type: 'string'
    },
    auth0Domain: {
        description: 'for custom auth0 account',
        type: 'string'
    }
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
                else             argv.secret = Object.create(null);

                if (argv.param) parseHash(argv, 'param');
                else            argv.param = Object.create(null);

                if (argv.tokenLimit) parseHash(argv, 'tokenLimit');
                if (argv.containerLimit) parseHash(argv, 'containerLimit');

                if (argv.auth0 && argv.share)
                    throw new Error('Cannot specify both --share and --auth0');

                if (argv.auth0 || argv.auth0 === '') {
                    var clientId = argv.clientId || process.env.AUTH0_CLIENT_ID;
                    var clientSecret = argv.clientSecret || process.env.AUTH0_CLIENT_SECRET;
                    var auth0Domain = argv.auth0Domain || process.env.AUTH0_DOMAIN;

                    if(clientId)
                        argv.clientId = clientId;
                    if(clientSecret)
                        argv.clientSecret = clientSecret;
                    if(auth0Domain)
                        argv.auth0Domain = auth0Domain;

                    // Because yargs turns n passes of --cmd into array
                    argv.auth0 = {
                        emails: ((typeof argv.auth0 === 'string') ?
                            argv.auth0
                                .split(',')
                                .map(function (str) {
                                    return str.trim();
                                })
                                .filter(function (str) {
                                    return str;
                                })
                                : argv.auth0)
                                .join(',')
                    }

                    // Add custom auth0 accout
                    if (argv.clientId && argv.clientSecret && argv.auth0Domain) {
                        if(!argv.auth0) argv.auth0 = {};

                        argv.auth0.client_id = argv.clientId;
                        argv.auth0.domain = argv.auth0Domain;

                        argv.secret.WEBTASK_JWT_SECRET = argv.clientSecret;
                        argv.param.WEBTASK_JWT_AUD = argv.clientId;

                    } else if(argv.clientId || argv.clientSecret || argv.auth0Domain) {
                        throw new Error('Must specify clientId, clientSecret and auth0Domain for custom Auth0 account')
                    }
                }

                if (argv.auth0 === '') argv.auth0 = {};

                if (argv.share || (argv.auth0 && !argv.auth0.domain && !argv.auth0.client_id))
                    argv.secret.WEBTASK_JWT_SECRET = getSecret(argv);
                    argv.param.WEBTASK_JWT_AUD = SHARED_ACCOUNT_CLIENT_ID;

                return true;
            });
    },
	handler: handleCreate,
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
    
    var generation = 0;
    var pending = createToken();
    
    if (argv.watch) {
        var watcher = Watcher();

        if(!argv.nolivereload) {
            var reloadServer = Livereload.createServer();
            console.log('Livereload server listening: http://livereload.com/extensions\n');
        }
        
        watcher.add(argv.file_name);
        
        watcher.on('change', function (file, stat) {
            generation++;
            
            if (!argv.json) {
                console.log('\nFile change detected, creating generation'
                    , generation);
            }
            
            argv.code = Fs.readFileSync(argv.file_name, 'utf8');
            
            pending = pending
                .then(createToken)
                .tap(function () {
                    if(!argv.nolivereload)
                        reloadServer.refresh(argv.file_name);
                });
        });
    }
    
    return pending;
    
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
                var promises = [];
                var unnamed_url = profile.url + '/api/run/'
                    + (argv.container || profile.container);

                if (argv.name)
                    var named_url = profile.url
                        + '/api/run/'
                        + (argv.container || profile.container)
                        + '/' + argv.name;

                if(argv.share) {
                    var aud = named_url.replace('https:\/\/', '');

                    // This is the token we attach to the URL for the user
                    argv.share = getAuthToken({ aud: aud }, argv.secret.WEBTASK_JWT_SECRET);

                    // Also replace the shared clientId with the URL (the share method is not Auth0-based)
                    argv.param.WEBTASK_JWT_AUD = aud
                }

                if(argv.auth0) {
                    var actual_name = argv.name + '_auth0';
                    var lock_webtask = {
                        name: argv.name,
                        code: Fs.readFileSync(__dirname + '/lib/lock_webtask.js', 'utf8'),
                        param: {
                            SHARED_ACCOUNT_URL: argv.auth0.client_id ? '' : 'https://webtask.it.auth0.com/api/run/wt-milomord-gmail_com-0/verify_auth0_token',
                            baseUrl: profile.url,
                            container: (argv.container || profile.container),
                            taskname: actual_name,
                            client_id: argv.auth0.client_id || SHARED_ACCOUNT_CLIENT_ID,
                            domain: argv.auth0.domain || SHARED_ACCOUNT_DOMAIN
                         },
                         secret: {
                            TOKEN_SECRET: argv.secret.WEBTASK_JWT_SECRET,
                            EMAILS: argv.auth0.emails

                        },
                    }

                    promises.push(profile.createToken(_.assign({}, argv, { name: actual_name })));
                    promises.push(profile.createToken(lock_webtask));
                } else {
                    promises.push(profile.createToken(argv))
                }

                return Bluebird.all(promises)
                    .then(function (token) {
                      var unnamed_qs = {
                        key: token,
                        webtask_no_cache: argv.prod ? undefined : 1
                      }; 

                      var named_qs = {
                        key: argv.share || undefined,
                        webtask_no_cache: argv.prod ? undefined : 1
                      }
                        var result = {
                            token: token,
                            webtask_url: unnamed_url + '?' + Qs.stringify(unnamed_qs)
                        };

                        if (argv.name)
                            result.named_webtask_url = named_url + '?' + Qs.stringify(named_qs)

                        return result;
                    });
            })
            .then(function (data) {
                var auth_token = '';

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

function getSecret(argv) {
    try {
        return (process.env.JWT_SECRET || Crypto.randomBytes(128).toString('base64'));
    } catch(e) {
        console.log('Couldn\'t generate random secret: ' + e.message);
    }
}

function getAuthToken(payload, secret) {
    try {
        return Jwt.sign(payload, new Buffer(secret, 'base64'));
    } catch(e) {
        throw new Error('Unable to generate authorization token.');
    }
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
