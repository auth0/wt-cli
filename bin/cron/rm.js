var Cli = require('structured-cli');
var _ = require('lodash');


module.exports = Cli.createCommand('rm', {
    description: 'Remove a scheduled webtask',
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
    handler: handleCronRm,
});


// Command handler

function handleCronRm(args) {
    var profile = args.profile;
    
    return profile.removeCronJob({ container: args.container || profile.container, name: args.name })
        .then(onCronJobRemoved, onCronError);

    
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
