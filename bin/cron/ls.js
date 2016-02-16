var Cli = require('structured-cli');
var ConfigFile = require('../../lib/config');
var PrintCronJob = require('../../lib/printCronJob');
var _ = require('lodash');


module.exports = Cli.createCommand('ls', {
    description: 'List scheduled webtasks',
    handler: handleCronLs,
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
});


// Command handler

function handleCronLs(args) {
    var config = new ConfigFile();

    return config.getProfile(args.profile)
        .then(onProfile);
        
    
    function onProfile(profile) {
        return profile.listCronJobs({ container: args.container || profile.container })
            .then(onCronListing);
    }
    
    function onCronListing(jobs) {
        if (args.output === 'json') {
            console.log(JSON.stringify(jobs, null, 2));
        } else {
            
            jobs.forEach(function (job, i) {
                if (i) console.log(); // Separator line
                
                PrintCronJob(job);
            });
        }
    }
}
