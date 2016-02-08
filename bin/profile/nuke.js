var Bluebird = require('bluebird');
var Chalk = require('chalk');
var Cli = require('../../cli');
var ConfigFile = require('../../lib/config');
var Errors = require('../../lib/errors');
var Promptly = Bluebird.promisifyAll(require('promptly'));
var _ = require('lodash');


module.exports = Cli.command('nuke', {
    description: 'destroy all existing profiles and their secrets',
    handler: handleProfileNuke,
    options: {
        force: {
            alias: 'f',
            description: 'do not prompt for confirmation',
            type: 'boolean',
        },
        silent: {
            alias: 's',
            description: 'no output',
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
                            throw Errors.cancelled('User chose not to nuke '
                                + 'all profiles.');
                    });
        })
        .then(config.removeAllProfiles.bind(config))
        .then(config.save.bind(config))
        .then(function () {
            if (!args.silent) {
                console.log(Chalk.green('All secrets and profiles deleted. Initialize '
                    + 'again with `wt init`.'));
            }
        })
        .catch(_.matchesProperty('code', 'E_CANCELLED'), _.noop);
}

