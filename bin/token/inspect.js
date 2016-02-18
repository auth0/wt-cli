var Cli = require('structured-cli');


module.exports = Cli.createCommand('inspect', {
    description: 'Inspect webtask tokens',
    plugins: [
        require('../_plugins/profile'),
    ],
    handler: handleTokenCreate,
    optionGroups: {
        'Inspect options': {
            'decrypt': {
                type: 'boolean',
                description: 'Return the decrypted secrets',
            },
            'fetch-code': {
                type: 'boolean',
                description: 'Return the webtask code',
                dest: 'fetchCode',
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
    params: {
        subject: {
            description: 'The subject token to be inspected',
            type: 'string',
            required: true,
        },
    },
});


// Command handler

function handleTokenCreate(args) {
    var profile = args.profile;
    
    return profile.inspectToken({ token: args.subject, decrypt: args.decrypt, fetch_code: args.fetchCode })
        .catch(function (err) {
            if (err.statusCode >= 500) throw Cli.error.serverError(err.message);
            if (err.statusCode >= 400) throw Cli.error.badRequest(err.message);
            
            throw err;
        })
        .then(onTokenData);
        
    
    function onTokenData(data) {
        if (args.output === 'json') {
            console.log(data);
        } else {
            console.log(data);
        }
    }
}
