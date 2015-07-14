var Bluebird = require('bluebird');
var Boom = require('boom');
var Colors = require('colors');
var Cli = require('nested-yargs');
var Jws = require('jws');
var Promptly = require('promptly');
var Webtask = require('../');
var _ = require('lodash');

Bluebird.promisifyAll(Promptly);


var profile = module.exports = Cli.createCategory('profile',
    'Manage webtask profiles');
    
profile.command(Cli.createCommand('init', 'Manage webtask profiles', {
    options: {
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
    },
    handler: handleInit,
}));
    
profile.command(Cli.createCommand('ls', 'List existing webtask profiles', {
    options: infoOptions,
    handler: handleList,
}));
    
profile.command(Cli.createCommand('get', 'Get information about an existing webtask profile', {
    params: '[profile]',
    options: _.extend({}, infoOptions, {
        field: {
            description: 'return only this field',
            type: 'string',
        },
    }),
    handler: handleGet,
}));
    
profile.command(Cli.createCommand('rm', 'Remove an existing webtask profile', {
    params: '<profile>',
    options: {
        json: {
            alias: 'j',
            description: 'json output',
            type: 'boolean',
        },
    },
    handler: handleRemove,
}));
    
profile.command(Cli.createCommand('nuke', 'Destroys all existing profiles and their secrets', {
    options: {
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
    },
    handler: handleNuke,
}));



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

  
function handleInit (argv) {
    var config = Webtask.configFile();
    
    return config.getProfile(argv.profile)
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
                    
                    console.log(('Welcome to webtasks! Create one with '
                        + '`wt token create`'.bold + '.').green);
                });
        })
        .catch(function (e) {
            // Handle cancellation silently (don't trigger help)
            if (e.isBoom && e.output.statusCode === 409) return;
            
            throw e;
        });
}
  
function handleList (argv) {
    var config = Webtask.configFile();

    return config.load()
        .then(function (profiles) {
            if (argv.json) {
                console.log(profiles);
            } else if (_.isEmpty(profiles)) {
                throw new Error('No profiles are configured. Create one with '
                    + '`wt init`.');
            }
            else {
                _.forEach(profiles, function (profile, profileName) {
                    printProfile(profileName, profile, argv.details);
                    console.log();
                });
            }
        });
}
  
function handleGet (argv) {
    var config = Webtask.configFile();

    return config.getProfile(argv.params.profile)
        .then(function (profile) {
            if (argv.field) {
                var value = profile[argv.field.toLowerCase()];
                
                if (!value) throw new Error('Field `' + argv.field + '` does not '
                    + 'exist');
                    
                console.log(argv.json ? JSON.stringify(value) : value);
            } else {
                if (argv.json) console.log(profile);
                else printProfile(argv.params.profile, profile, argv.details);
            }
        });
}
  
function handleRemove (argv) {
    var config = Webtask.configFile();
    
    return config.removeProfile(argv.params.profile)
        .then(config.save.bind(config))
        .then(function () {
            if (argv.json) console.log(true);
            else console.log(('Profile `' + argv.params.profile + '` removed.').green);
        });
}
  
function handleNuke (argv) {
    var config = Webtask.configFile();
    
    return config.load()
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
        .catch(function (e) {
            // Handle cancellation silently (don't trigger help)
            if (e.isBoom && e.output.statusCode === 409) return;
        });
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
        })
        .catch(function (err) {
            console.log(('We were unable to verify your identity.').red);
            
            return Promptly.confirmAsync('Would you like to try again? [Yn]', {
                'default': true,
            })
                .then(function (tryAgain) {
                    if (!tryAgain)
                        throw Boom.unauthorized('Failed to verify user\'s '
                            + 'identity.', err);
                    
                    return getVerifiedProfile();
                });
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
