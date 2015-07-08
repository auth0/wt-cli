var Colors = require('colors');
var Fs = require('fs');
var Path = require('path');
var Watcher = require('filewatcher');
var Webtask = require('../');
var _ = require('lodash');


var commands = {
    create: {
        description: 'Create a webtask token from code',
        handler: handleCreate,
    },
};

var tokenOptions = {
    name: {
        alias: 'n',
        description: 'name of the webtask',
        type: 'string',
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
    parse: {
        type: 'boolean',
        description: 'parse JSON and urlencoded request body',
        'default': true,
    },
    merge: {
        type: 'boolean',
        description: 'merge body data into `context.data`',
        'default': true,
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
    parse: {
        type: 'boolean',
        description: 'parse JSON and urlencoded request body',
        'default': false,
    },
    merge: {
        type: 'boolean',
        description: 'merge body data into `context.data`',
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

module.exports = handleCreate;/*function (yargs) {
    _.forEach(commands, function (commandDef, command) {
        yargs.command(command, commandDef.description, commandDef.handler);
    });
    
    var argv = yargs.usage('Usage: $0 token <command> [options]')
        .help('help')
        .check(function (argv) {
            var commandName = argv._[1];
            var command = commands[commandName];
            
            if (!commandName) throw new Error('Please enter a valid command.');
            if (!command) throw new Error('No such command `' + commandName 
                + '`');
        })
        .argv;
};*/

  
function handleCreate (yargs) {
    var advanced = false;

    // We want to only show advanced options if requested or if at least one
    // is already being used (that is not also a basic option)
    if (yargs.argv.advanced || yargs.argv.a
        || _.find(yargs.argv, function (val, key) {
            
        return advancedTokenOptions[key] && !tokenOptions[key];
    })) {
        _.extend(tokenOptions, advancedTokenOptions);
        
        advanced = true;
    }
    
    var argv = yargs.usage('Usage: $0 create [options] <file_or_url>')
        .options(tokenOptions)
        .help('help')
        .demand(2, 'Please indicate the file or url of the code for the webtask')
        .check(function (argv) {
            if (argv.issuanceDepth
                && (Math.floor(argv.issuanceDepth) !== argv.issuanceDepth
                || argv.issuanceDepth < 0)) {
                
                throw new Error('The `issuance-depth` parameter must be a '
                    + 'non-negative integer.');
            }
            
            if (['all', 'url', 'token'].indexOf(argv.output) < 0) {
                throw new Error('The `output` parameter must be one of: '
                    + '`all`, `url` or `token`.');
            }
            
            if (argv.nbf) parseDate(argv, 'nbf');
            if (argv.exp) parseDate(argv, 'exp');
            
            if (argv.secret) parseHash(argv, 'secret');
            if (argv.param) parseHash(argv, 'param');
            if (argv.tokenLimit) parseHash(argv, 'tokenLimit');
            if (argv.containerLimit) parseHash(argv, 'containerLimit');

            return true;
        })
        .fail(function (msg) {
            yargs.showHelp();
            console.log(msg.red);
            process.exit(1);
        })
        .argv;
    

    var fileOrUrl = argv._[1];
    var fol = fileOrUrl.toLowerCase();

    if (fol.indexOf('http://') === 0 || fol.indexOf('https://') === 0) {
        argv.code_url = fileOrUrl;

        if (argv.watch) {
            return logError(new Error('The --watch option can only be used '
                + 'when a file name is specified.'));
        }
    } else {
        argv.file_name = Path.resolve(process.cwd(), fileOrUrl);
        
        try {
            argv.code = Fs.readFileSync(argv.file_name, 'utf8');
        } catch (e) {
            return logError(new Error('Unable to read the file `'
                + argv.file_name + '`.'));
        }
    }


    var generation = 0;
    var pending = createToken();
    
    if (argv.watch) {
        var watcher = Watcher();
        
        watcher.add(argv.file_name);
        
        watcher.on('change', function (file, stat) {
            generation++;
            
            if (!argv.json) {
                console.log('File change detected, creating generation'
                    , generation);
            }
            
            try {
                argv.code = Fs.readFileSync(argv.file_name, 'utf8');
            } catch (e) {
                logError(e);
            }
            
            pending = pending
                .then(createToken);
        });
    }
    
    function createToken () {
        var config = Webtask.configFile();
        
        return config.load()
            .then(function (profiles) {
                if (_.isEmpty(profiles)) {
                    throw new Error('You must create a profile to begin using '
                        + 'this tool: `wt profile init`.');
                }
                
                return config.getProfile(argv.profile);
            })
            .then(function (profile) {
                return profile.createToken(argv)
                    .then(function (token) {
                        var result = {
                            token: token,
                            webtask_url: profile.url + '/api/run/'
                                + profile.container + '?key=' + token,
                        };
                        if (argv.name) {
                            result.named_webtask_url = profile.url
                                + '/api/run/'
                                + profile.container
                                + '/' + argv.name;
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

                return data.token;
            })
            .catch(logError);
    }
}

function logError (e) {
    console.error(e);
    console.log(e.message.red);
    if (e.trace) console.log(e.trace);
    process.exit(1);
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
