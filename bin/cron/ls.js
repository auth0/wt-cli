var Chalk = require('chalk');
var Cli = require('structured-cli');
var PrintCronJob = require('../../lib/printCronJob');
var _ = require('lodash');
var keyValList2Object = require('../../lib/keyValList2Object');


module.exports = Cli.createCommand('ls', {
    description: 'List scheduled webtasks',
    plugins: [
        require('../_plugins/profile'),
    ],
    optionGroups: {
        'Filtering': {
            'meta': {
                action: 'append',
                defaultValue: [],
                description: 'Metadata describing the scheduled webtask. This is a set of string key value pairs. Only scheduled webtasks with matching metadata will be returned.',
                dest: 'meta',
                metavar: 'KEY=VALUE',
                type: 'string',
            },

        },
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

    keyValList2Object(args, 'meta');
    
    return profile.listCronJobs({ container: args.container || profile.container, meta: args.meta })
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
