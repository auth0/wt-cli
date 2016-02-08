var Chalk = require('chalk');
var Cli = require('../../cli');
var ConfigFile = require('../../lib/config');
var _ = require('lodash');


var printProfile = require('./printProfile');


module.exports = Cli.command('ls', {
    description: 'list existing webtask profiles',
    handler: handleProfileList,
    options: {
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
        token: {
            alias: 't',
            description: 'show tokens (hidden by default)',
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
                console.log('No webtask profiles found. To get started:\n');
                console.log(Chalk.bold('$ wt init'));
                
                process.exit(1);
            }
            else {
                _.forEach(profiles, function (profile, profileName) {
                    printProfile(profileName, profile, { details: args.details, token: args.token });
                    console.log();
                });
            }
        });
}

