var Chalk = require('chalk');
var Cli = require('structured-cli');


module.exports = Cli.createCommand('revoke', {
    description: 'Revoke a webtask token',
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
    handler: handleTokenRevoke,
    params: {
        subject: {
            description: 'The subject token to be revoked',
            type: 'string',
            required: true,
        },
    },
});


// Command handler

function handleTokenRevoke(args) {
    var profile = args.profile;
    
    return profile.revokeToken(args.subject)
        .catch(function (err) {
            if (err.statusCode >= 500) throw Cli.error.serverError(err.message);
            if (err.statusCode >= 400) throw Cli.error.badRequest(err.message);
            
            throw err;
        })
        .then(onTokenData);
        
    
    function onTokenData(data) {
        if (args.output === 'json') {
            console.log(true);
        } else {
            console.log(Chalk.green('Token revoked.'));
        }
    }
}
