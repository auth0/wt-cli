var Boom = require('boom');
var Colors = require('colors');
var Jws = require('jws');
var Promptly = require('promptly');
var Webtask = require('../');
var _ = require('lodash');


var commands = {
    init: {
        description: 'Create or update an existing webtask profile',
        handler: handleInit,
    },
    ls: {
        description: 'List existing webtask profiles',
        handler: handleList,
    },
    get: {
        description: 'Get information about an existing webtask profile',
        handler: handleGet,
    },
    rm: {
        description: 'Remove an existing webtask profile',
        handler: handleRemove,
    },
    nuke: {
        description: 'Destroys all existing profiles and their secrets',
        handler: handleNuke,
    },
};

var infoOptions = {
    json: {
        alias: 'j',
        description: 'json output',
        type: 'boolean',
    },
    details: {
        alias: 'd',
        description: 'show more details',
        type: 'boolean',
    },
};


module.exports = function (yargs) {
    _.forEach(commands, function (commandDef, command) {
        yargs.command(command, commandDef.description, commandDef.handler);
    });
    
    var argv = yargs.usage('Usage: $0 profile <command> [options]')
        .help('help')
        .check(function (argv) {
            var commandName = argv._[1];
            var command = commands[commandName];
            
            if (!commandName) throw new Error('Please enter a valid command.');
            if (!command) throw new Error('No such command `' + commandName 
                + '`');
        })
        .argv;
};

  
function handleInit (yargs) {
    var argv = yargs.usage('Usage: $0 profile create [options]')
        .options({
            token: {
                alias: 't',
                description: 'webtask token used to issue new tokens',
                type: 'string',
            },
            container: {
                alias: 'c',
                description: 'default webtask container',
                type: 'string',
            },
            url: {
                alias: 'u',
                description: 'webtask service URL',
                type: 'string',
            },
            profile: {
                alias: 'p',
                description: 'name of the profile to set up',
                'default': 'default',
                type: 'string',
            },
        })
        .help('help')
        .argv;
        
    var config = Webtask.configFile();
    
    config.getProfile(argv.profile)
        .then(function (profile) {
            console.log('You already have the `' + argv.profile
                + '` profile:');
            
            printProfile(argv.profile, profile);
            
            return Promptly.confirmAsync('Do you want to override it? [yN]', {
                'default': false,
            })
                .then(function (override) {
                    if (!override)
                        throw Boom.conflict('User chose not to override '
                            + 'existing profile.', profile);
                });
        })
        .catch(function (e) {
            if (e.isBoom && e.output.statusCode === 404) {
                // loadProfile will throw a notFound error
                // if the profile is not defined. Since
                // this is not an error in this context
                // we convert the promise to resolve to a 
                // null profile
                return;
            } else {
                throw e;
            }
        })
        .then(function () {
            return (argv.token && argv.container && argv.url)
                ? _.pick(argv, ['url', 'container', 'token'])
                : getVerifiedProfile();
        })
        .then(config.setProfile.bind(config, argv.profile))
        .then(function (profile) {
            return config.save()
                .then(function () {
                    printProfile(argv.profile, profile);
                    
                    console.log('Welcome to webtasks! You can create one with '
                        + '`wt token create`.'.green);
                });
        })
        .catch(logError);
}
  
function handleList (yargs) {
    var argv = yargs.usage('Usage: $0 profile ls')
        .options(infoOptions)
        .help('help')
        .argv;
        
    var config = Webtask.configFile();

    config.load()
        .then(function (profiles) {
            if (argv.json) {
                console.log(profiles);
            } else if (_.isEmpty(profiles)) {
                throw new Error('No profiles are configured. Create one with '
                    + '`wt profile init`.');
            }
            else {
                _.forEach(profiles, function (profile, profileName) {
                    printProfile(profileName, profile, argv.details);
                    console.log();
                });
            }
        })
        .catch(logError);
}
  
function handleGet (yargs) {
    var argv = yargs.usage('Usage: $0 profile get [field]')
        .options(_.extend(infoOptions, {
            profile: {
                alias: 'p',
                description: 'name of the profile to use',
                'default': 'default',
                type: 'string',
            },
        }))
        .help('help')
        .argv;
        
    var config = Webtask.configFile();
    var field = argv._[2];

    config.getProfile(argv.profile)
        .then(function (profile) {
            if (field) {
                var value = profile[field.toLowerCase()];
                
                if (!value) throw new Error('Field `' + field + '` does not '
                    + 'exist');
                    
                console.log(argv.json ? JSON.stringify(value) : value);
            } else {
                if (argv.json) console.log(profile);
                else printProfile(argv.profile, profile, argv.details);
            }
        })
        .catch(logError);
}
  
function handleRemove (yargs) {
    var argv = yargs.usage('Usage: $0 profile rm -p <profile>')
        .options({
            profile: {
                alias: 'p',
                description: 'name of the profile to remove',
                demand: true,
                type: 'string',
            },
            json: {
                alias: 'j',
                description: 'json output',
                type: 'boolean',
            },
        })
        .help('help')
        .argv;
        
    var config = Webtask.configFile();
    
    config.removeProfile(argv.profile)
        .then(config.save.bind(config))
        .then(function () {
            if (argv.json) console.log(true);
            else console.log('Profile `' + argv.profile + '` removed.');
        })
        .catch(logError);
}
  
function handleNuke (yargs) {
    var argv = yargs.usage('Usage: $0 profile nuke')
        .options({
            force: {
                alias: 'f',
                description: 'do not prompt',
                type: 'boolean',
            },
            json: {
                alias: 'j',
                description: 'json output',
                type: 'boolean',
            },
        })
        .help('help')
        .argv;
        
    var config = Webtask.configFile();
    
    config.load()
        .then(function () {
            return argv.force
                ? true
                : Promptly.confirmAsync('Do you want to remove all secrets and '
                    + 'profile information?? [yN]', {
                    'default': false,
                })
                    .then(function (force) {
                        if (!force)
                            throw Boom.conflict('User chose not to nuke '
                                + 'all profiles.');
                    });
        })
        .then(config.removeAllProfiles.bind(config))
        .then(config.save.bind(config))
        .then(function () {
            if (argv.json) console.log(true);
            else console.log('All secrets and profiles deleted. Initialize '
                + 'again with `wt init`.');
        })
        .catch(logError);
}

function getVerifiedProfile () {
    var verifier = Webtask.createUserVerifier();
    
    console.log('Please enter your e-mail or phone number, we will send you a '
        + 'verification code.');
    
    return Promptly.promptAsync('E-mail or phone number:')
        .then(function (phoneOrEmail) {
            return verifier.requestVerificationCode(phoneOrEmail)
                .then(function (verifyFunc) {
                    console.log('Please enter the verification code we sent to '
                        + phoneOrEmail + ' below.');
                    
                    return Promptly.promptAsync('Verification code:')
                        .then(verifyFunc);
                });
        })
        .then(function (data) {
            return {
                url: data.url,
                container: data.tenant,
                token: data.token,
            };
        });
}

function printProfile (name, profile, details) {
    console.log('Profile:   '.blue, name.green);
    console.log('URL:       '.blue, profile.url);
    console.log('Container: '.blue, profile.container);
    console.log('Token:     '.blue, profile.token);
    if (details) {
        var json = JSON.parse(Jws.decode(profile.token).payload);
        var keys = Object.keys(json).sort();
        keys.forEach(function (key) {
            var name = 'Token.' + key + ':';
            while (name.length < 11) name += ' ';
            console.log(name.blue, json[key]);
        });
    }
}

function logError (e) {
    console.log(e.message.red);
    if (e.trace) console.log(e.trace);
    process.exit(1);
}
