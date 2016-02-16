var Cli = require('structured-cli');
var ConfigFile = require('../../lib/config');
var PrintCronJob = require('../../lib/printCronJob');


module.exports = Cli.createCommand('get', {
    description: 'Get information about a scheduled webtask',
    handler: handleCronGet,
    options: {
        profile: {
            alias: 'p',
            description: 'Webtask profile to use',
            type: 'string',
        },
        container: {
            alias: 'c',
            description: 'Overwrite the profile\'s webtask container',
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

function handleCronGet(args) {
    var config = new ConfigFile();

    return config.getProfile(args.profile)
        .then(onProfile);
        
    
    function onProfile(profile) {
        return profile.getCronJob({ container: args.container || profile.container, name: args.name })
            .then(onCronJob, onCronError);
    }
    
    function onCronJob(job) {
        if (args.output === 'json') {
            console.log(JSON.stringify(job, null, 2));
        } else {
            PrintCronJob(job);
        }
    }
    
    function onCronError(err) {
        switch (err.statusCode) {
            case 404: throw Cli.error.notFound('No such webtask: ' + args.name);
            default: throw err;
        }
    }
}
