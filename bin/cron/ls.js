var Chalk = require('chalk');
var Cli = require('structured-cli');
var PrintCronJob = require('../../lib/printCronJob');
var _ = require('lodash');


module.exports = Cli.createCommand('ls', {
    description: 'List scheduled webtasks',
    plugins: [
        require('../_plugins/profile'),
    ],
    optionGroups: {
        'Output options': {
            output: {
                alias: 'o',
                description: 'Set the output format',
                choices: ['json'],
                type: 'string',
            },
        },
    },
    handler: handleCronLs,
});


// Command handler

function handleCronLs(args) {
    var profile = args.profile;
    
    return profile.listCronJobs({ container: args.container || profile.container })
        .then(onCronListing);
    
    
    function onCronListing(jobs) {
        if (args.output === 'json') {
            console.log(JSON.stringify(jobs, null, 2));
        } else {
            
            jobs.forEach(function (job, i) {
                if (i) console.log(); // Separator line
                
                PrintCronJob(job);
            });
            
            if (!jobs.length) {
                console.log('No scheduled webtasks found. To create one:');
                console.log(Chalk.bold('$ wt cron schedule [options] "* * * * *" [file_or_url]'));
            }
        }
    }
}
