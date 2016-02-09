var Chalk = require('chalk');
var Cli = require('../../cli');
var ConfigFile = require('../../lib/config');
var Errors = require('../../lib/errors');
var _ = require('lodash');


var printProfile = require('./printProfile');


module.exports = Cli.command('get', {
    description: 'Get information about an existing webtask profile',
    handler: handleProfileGet,
    options: {
        json: {
            alias: 'j',
            description: 'JSON output',
            type: 'boolean',
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
        token: {
            alias: 't',
            description: 'Show tokens (hidden by default)',
            type: 'boolean',
        },
    },
    params: {
        'profile': {
            description: 'Profile to inspect',
            type: 'string',
            defaultValue: 'default',
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
                    console.error(Chalk.red('Field `' + args.field + '` does not '
                    + 'exist'));
                    
                    process.exit(1);
                }

                console.log(args.json ? JSON.stringify(value) : value);
            } else {
                if (args.json) console.log(profile);
                else printProfile(args.profile, profile, { details: args.details, token: args.token });
            }
        })
        .catch(_.matchesProperty('code', 'E_NOTFOUND'), function (err) {
            console.error(Chalk.red(err.message));
            
            process.exit(1);            
        });
}

