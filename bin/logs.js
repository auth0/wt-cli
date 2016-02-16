var Bluebird = require('bluebird');
var Chalk = require('chalk');
var Cli = require('structured-cli');
var ConfigFile = require('../lib/config');
var Errors = require('../lib/errors');
var Logs = require('../lib/logs');
var _ = require('lodash');


module.exports = Cli.createCommand('logs', {
    description: 'Streaming, real-time logs',
    handler: handleLogs,
    options: {
        raw: {
            alias: 'r',
            description: 'Do not pretty print',
            type: 'boolean',
        },
        verbose: {
            alias: 'v',
            description: 'Show verbose logs',
            type: 'boolean',
        },
        profile: {
            alias: 'p',
            description: 'Name of the webtask profile to use',
            type: 'string',
        },
    },
    params: {
        'container': {
            description: 'Container from which to stream logs',
            type: 'string',
        },
    },
});


// Command handler

function handleLogs(args) {
    var config = new ConfigFile();

    return config.load()
        .then(loadProfile)
        .then(function (profile) {
            Logs.createLogStream(profile, args);
            
            return Bluebird.delay(30 * 60 * 1000);
        })
        .catch(_.matchesProperty('code', 'E_NOTFOUND'), function (err) {
            console.error(Chalk.red(err.message));
            
            process.exit(1);            
        });
    
    
    function loadProfile(profiles) {
        if (_.isEmpty(profiles)) {
            throw Errors.notFound('No webtask profiles configured');
        }
        
        return config.getProfile(args.profile);
    }
}

