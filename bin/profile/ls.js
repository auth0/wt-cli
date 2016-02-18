var Chalk = require('chalk');
var Cli = require('structured-cli');
var ConfigFile = require('../../lib/config');
var PrintProfile = require('../../lib/printProfile');
var _ = require('lodash');


module.exports = Cli.createCommand('ls', {
    description: 'List existing webtask profiles',
    optionGroups: {
        'Output options': {
            'output': {
                alias: 'o',
                description: 'Set the output format',
                choices: ['json'],
                type: 'string',
            },
            'details': {
                alias: 'd',
                description: 'Show more details',
                type: 'boolean',
            },
            'show-token': {
                description: 'Show tokens (hidden by default)',
                dest: 'showToken',
                type: 'boolean',
            },
        },
    },
    handler: handleProfileList,
});


// Command handler

function handleProfileList(args) {
    var config = new ConfigFile();

    return config.load()
        .tap(function (profiles) {
            if (args.output === 'json') {
                var props = ['url', 'container'];
                
                // Strip tokens by default
                if (args.showToken) {
                    props.push('token');
                }
                
                console.log(_.mapValues(profiles, _.partialRight(_.pick, props)));
            } else if (_.isEmpty(profiles)) {
                throw Cli.error.hint('No webtask profiles found. To get started:\n'
                    + Chalk.bold('$ wt init'));
            }
            else {
                var i = 0;
                _.forEach(profiles, function (profile, profileName) {
                    if (i++) console.log();
                    PrintProfile(profile, { details: args.details, token: args.token });
                });
            }
        });
}

