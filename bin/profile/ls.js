var Chalk = require('chalk');
var Cli = require('structured-cli');
var ConfigFile = require('../../lib/config');
var _ = require('lodash');


var printProfile = require('./printProfile');


module.exports = Cli.createCommand('ls', {
    description: 'List existing webtask profiles',
    handler: handleProfileList,
    options: {
        'json': {
            alias: 'j',
            description: 'JSON output',
            type: 'boolean',
        },
        'details': {
            alias: 'd',
            description: 'Show more details',
            type: 'boolean',
        },
        'show-token': {
            alias: 't',
            description: 'Show tokens (hidden by default)',
            dest: 'token',
            type: 'boolean',
        },
    },
});


// Command handler

function handleProfileList(args) {
    var config = new ConfigFile();

    return config.load()
        .tap(function (profiles) {
            if (args.json) {
                // Strip tokens by default
                if (!args.token) {
                    profiles = _.mapValues(profiles, _.partialRight(_.omit, 'token'));
                }
                
                console.log(profiles);
            } else if (_.isEmpty(profiles)) {
                throw Cli.error.hint('No webtask profiles found. To get started:\n'
                    + Chalk.bold('$ wt init'));
            }
            else {
                _.forEach(profiles, function (profile, profileName) {
                    printProfile(profile, { details: args.details, token: args.token });
                    console.log();
                });
            }
        });
}

