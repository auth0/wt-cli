var Chalk = require('chalk');
var Cli = require('structured-cli');
var ConfigFile = require('../../lib/config');
var _ = require('lodash');


module.exports = Cli.createCommand('rm', {
    description: 'Remove a saved webtask profile',
    handler: handleProfileRemove,
    options: {
        silent: {
            alias: 's',
            description: 'No output',
            type: 'boolean',
        },
    },
    params: {
        'profile': {
            description: 'Profile to remove',
            type: 'string',
            defaultValue: 'default',
        },
    },
});


// Command handler

function handleProfileRemove(args) {
    var config = new ConfigFile();


    return config.removeProfile(args.profile)
        .then(config.save.bind(config))
        .then(function () {
            if (!args.silent) {
                console.log(Chalk.green('Profile `' + args.profile + '` removed.'));
            }
        });
}

