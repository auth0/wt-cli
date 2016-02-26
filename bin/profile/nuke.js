var Bluebird = require('bluebird');
var Chalk = require('chalk');
var Cli = require('structured-cli');
var ConfigFile = require('../../lib/config');
var Promptly = Bluebird.promisifyAll(require('promptly'));
var _ = require('lodash');


module.exports = Cli.createCommand('nuke', {
    description: 'Destroy all existing profiles and their secrets',
    handler: handleProfileNuke,
    options: {
        force: {
            alias: 'f',
            description: 'Do not prompt for confirmation',
            type: 'boolean',
        },
        silent: {
            alias: 's',
            description: 'No output',
            type: 'boolean',
        },
    },
});


// Command handler

function handleProfileNuke(args) {
    var config = new ConfigFile();

    return config.load()
        .then(function () {
            return args.force
                ? true
                : Promptly.confirmAsync('Do you want to remove all secrets and '
                    + 'profile information?? [yN]', {
                    'default': false,
                })
                    .then(function (force) {
                        if (!force)
                            throw Cli.error.cancelled('Cancelled');
                    });
        })
        .then(config.removeAllProfiles.bind(config))
        .then(config.save.bind(config))
        .then(function () {
            if (!args.silent) {
                console.log(Chalk.green('All secrets and profiles deleted. Initialize '
                    + 'again with `wt init`.'));
            }
        });
}

