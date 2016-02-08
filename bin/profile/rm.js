var Chalk = require('chalk');
var Cli = require('../../cli');
var ConfigFile = require('../../lib/config');
var Errors = require('../../lib/errors');
var _ = require('lodash');


var printProfile = require('./printProfile');


module.exports = Cli.command('rm', {
    description: 'remove a saved webtask profile',
    handler: handleProfileRemove,
    options: {
        silent: {
            alias: 's',
            description: 'no output',
            type: 'boolean',
        },
    },
    params: {
        'profile': {
            description: 'profile to remove',
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
        })
        .catch(_.matchesProperty('code', 'E_NOTFOUND'), function (err) {
            console.error(Chalk.red(err.message));
            
            process.exit(1);            
        });
}

