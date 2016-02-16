var Cli = require('structured-cli');
var ConfigFile = require('../../lib/config');
var PrintCronJob = require('../../lib/printCronJob');
var _ = require('lodash');


module.exports = Cli.createCommand('rm', {
    description: 'Remove a scheduled webtask',
    handler: handleCronRm,
    options: {
        profile: {
            alias: 'p',
            description: 'Webtask profile to use',
            type: 'string',
        },
        container: {
            alias: 'c',
            description: 'List scheduled webtasks in this container',
            type: 'string',
        },
        output: {
            alias: 'o',
            description: 'Set the output format',
            choices: ['json'],
            type: 'string',
        }
    },
    params: {
        name: {
            description: 'Name of the cron job',
            type: 'string',
            required: true,
        }
    }
});


// Command handler

function handleCronRm(args) {
    var config = new ConfigFile();

    return config.getProfile(args.profile)
        .then(onProfile);
        
    
    function onProfile(profile) {
        return profile.removeCronJob({ container: args.container || profile.container, name: args.name })
            .then(onCronJobRemoved, onCronError);
    }
    
    function onCronJobRemoved() {
        if (args.output === 'json') {
            console.log(true);
        } else {
            console.log('Successfully removed the scheduled webtask: %s', args.name);
        }
    }
    
    function onCronError(err) {
        switch (err.statusCode) {
            case 404: throw Cli.error.notFound('No such webtask: ' + args.name);
            default: throw err;
        }
    }
}
