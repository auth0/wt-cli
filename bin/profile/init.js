var Bluebird = require('bluebird');
var Chalk = require('chalk');
var Cli = require('../../cli');
var ConfigFile = require('../../lib/config');
var Errors = require('../../lib/errors');
var Promptly = Bluebird.promisifyAll(require('promptly'));
var Sandbox = require('sandboxjs');
var UserVerifier = require('../../lib/userVerifier');
var _ = require('lodash');


var printProfile = require('./printProfile');


module.exports = Cli.command('init', {
    description: 'Create and update webtask profiles',
    handler: handleProfileInit,
    options: {
        token: {
            alias: 't',
            description: 'Webtask token used to issue new tokens',
            type: 'string',
        },
        container: {
            alias: 'c',
            description: 'Default webtask container',
            type: 'string',
        },
        url: {
            alias: 'u',
            defaultValue: 'https://webtask.it.auth0.com',
            description: 'Webtask service URL',
            type: 'string',
        },
        profile: {
            alias: 'p',
            defaultValue: 'default',
            description: 'Wame of the profile to set up',
            type: 'string',
        },
    },
    params: {
        'email_or_phone': {
            description: 'Email or phone number that will be used to configure a new webtask profile',
            type: 'string',
        },
    },
});


// Command handler

function handleProfileInit(args) {
    var config = new ConfigFile();

    return config.getProfile(args.profile)
        .then(confirmProfileOverwrite)
        // Ignore `E_NOTFOUND` errors which indicate that the profile does
        // not exist.
        .catch(_.matchesProperty('code', 'E_NOTFOUND'), _.identity)
        .then(verifyUserOrReturnProfile)
        .tap(updateProfile)
        .tap(showCompleteMessage)
        .catch(onError);
    
    
    function confirmProfileOverwrite(profile) {
        console.log('You already have the `' + args.profile
            + '` profile:');

        printProfile(args.profile, profile);

        return Promptly.confirmAsync('Do you want to override it? [y/N]', {
            'default': false,
        })
            .then(function (override) {
                if (!override) {
                    throw Errors.cancelled('User chose not to override '
                        + 'existing profile.', profile);
                }
            });
    }
    
    function verifyUserOrReturnProfile() {
        return (args.token && args.container && args.url)
            ? Sandbox.init(args)
            : getVerifiedProfile(args);
    }
    
    function updateProfile(profile) {
        console.log('updateProfile', profile);
        config.setProfile(args.profile, {
            url: profile.url,
            token: profile.token,
            container: profile.container,
        });
        
        return config.save();
    }
    
    function showCompleteMessage(profile) {
        console.log(Chalk.green('Welcome to webtasks! Create your first one as follows:\n\n'
            + Chalk.bold('$ echo "module.exports = function (cb) { cb(null, \'Hello\'); }" > hello.js\n')
            + Chalk.bold('$ wt create hello.js\n')));
    }
    
    function onError(err) {
        console.error(Chalk.red(err.message));
        
        process.exit(1);
    }
}


// Private helper functions

function getVerifiedProfile (args) {
    var profile$ = args.email_or_phone
        ?   sendVerificationCode(args.email_or_phone)
        :   promptForEmailOrPhone();


    return profile$
        .catch(_.matchesProperty('code', 'E_INVALID'), function (err) {
            console.log(Chalk.red(err.message));
            
            return promptForEmailOrPhone();
        })
        .then(function (profile) {
            return Sandbox.init({
                url: profile.url,
                token: profile.token,
                container: profile.tenant,
            });
        })
        .catch(function (err) {
            console.log(Chalk.red('We were unable to verify your identity.'));

            return Promptly.confirmAsync('Would you like to try again? [Y/n]', {
                'default': true,
            })
                .then(function (tryAgain) {
                    if (!tryAgain) {
                        throw Errors.cancelled('Failed to verify user\'s '
                            + 'identity.', err);
                    }

                    return getVerifiedProfile(args);
                });
        });

    
    function promptForEmailOrPhone() {
        console.log('Please enter your e-mail or phone number, we will send you a verification code.');

        return Promptly.promptAsync('E-mail or phone number:')
            .then(sendVerificationCode);
    }

}

function sendVerificationCode (phoneOrEmail) {
    var verifier = new UserVerifier();
    var FIVE_MINUTES = 1000 * 60 * 5;

    return verifier.requestVerificationCode(phoneOrEmail)
        .then(promptForVerificationCode);
    
    
    function promptForVerificationCode(verifyFunc) {
        console.log('Please enter the verification code we sent to '
            + phoneOrEmail + ' below.');

        return Promptly.promptAsync('Verification code:')
            .then(verifyFunc)
            .timeout(FIVE_MINUTES, 'Verification code expired.')
            .catch(function (e) {
                console.log('\n' + Chalk.red(e.message) + '\n');
            });
    }
}
