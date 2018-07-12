var Chalk = require('chalk');
var Cli = require('structured-cli');
var ConfigFile = require('../../lib/config');
var PrintProfile = require('../../lib/printProfile');
var _ = require('lodash');



module.exports = Cli.createCommand('get', {
    description: 'Get information about an existing webtask profile',
    handler: handleProfileGet,
    optionGroups: {
        'Output options': {
            output: {
                alias: 'o',
                description: 'Set the output format',
                choices: ['json'],
                type: 'string',
            },
            details: {
                alias: 'd',
                description: 'Show more details',
                type: 'boolean',
            },
            field: {
                alias: 'f',
                description: 'Return only the indicated field',
                type: 'string',
            },
            'show-token': {
                description: 'Show tokens (hidden by default)',
                dest: 'showToken',
                type: 'boolean',
            },
        },
    },
    params: {
        'profile': {
            description: 'Profile to inspect',
            type: 'string',
        },
    },
});


// Command handler

function handleProfileGet(args) {
    var config = new ConfigFile();

    return config.getProfile(args.profile)
        .then(function (profile) {
            if (args.field) {
                var value = profile[args.field.toLowerCase()];

                if (!value) {
                    throw Cli.error.invalid('Field `' + args.field + '` does not '
                    + 'exist');
                }

                console.log(args.output === 'json' ? JSON.stringify(value) : value);
            } else {
                if (args.output === 'json') {
                    console.log(profile);
                } else {
                    
                    PrintProfile(profile, { details: args.details, token: args.showToken });
                    
                    if (!args.showToken) console.log(Chalk.bold('* Hint: Use --show-token to show the token for this profile.'));
                    else console.log(Chalk.bold('* Warning: Tokens are like passwords and should not be shared.'));
                }
            }
        });
}

