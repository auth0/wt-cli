var Cli = require('structured-cli');
var PrintCronJob = require('../../lib/printCronJob');


module.exports = Cli.createCommand('get', {
    description: 'Get information about a scheduled webtask',
    plugins: [
        require('../_plugins/profile'),
    ],
    options: {
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
    },
    handler: handleCronGet,
});


// Command handler

function handleCronGet(args) {
    var profile = args.profile;
    
    return profile.getCronJob({ container: args.container || profile.container, name: args.name })
        .then(onCronJob, onCronError);

    
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
