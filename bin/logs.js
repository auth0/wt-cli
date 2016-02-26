var Bluebird = require('bluebird');
var Cli = require('structured-cli');
var Logs = require('../lib/logs');
var _ = require('lodash');


module.exports = Cli.createCommand('logs', {
    description: 'Streaming, real-time logs',
    plugins: [
        require('./_plugins/profile'),
    ],
    optionGroups: {
        'Log options': {
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
        },
        browser: {
            alias: 'b',
            description: 'create URL to see logs in a browser',
            type: 'boolean',
        },
    },
    handler: handleLogs,
});


// Command handler

function handleLogs(args) {
    var profile = args.profile;
    
    Logs.createLogStream(profile, args);
    
    return Bluebird.delay(30 * 60 * 1000, Cli.error.timeout('Command timed out after 30 min'));
}

