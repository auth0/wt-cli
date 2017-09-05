var Cli = require('structured-cli');
var Decode = require('jwt-decode');
var PrintTokenDetails = require('../../lib/printTokenDetails');


module.exports = Cli.createCommand('inspect', {
    description: 'Inspect named webtasks and webtask tokens',
    plugins: [
        require('../_plugins/profile'),
    ],
    handler: handleTokenInspect,
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
            description: 'The subject token or webtask name to be inspected',
            type: 'string',
            required: true,
        },
    },
});


// Command handler

function handleTokenInspect(args) {
    var profile = args.profile;
    var claims;

    try {
        claims = Decode(args.subject);
    } catch (__) { }

    var inspection$ = claims
        ?   profile.inspectToken({ token: args.subject, decrypt: args.decrypt, fetch_code: args.fetchCode, meta: +!!claims.jtn })
        :   profile.inspectWebtask({ name: args.subject, decrypt: args.decrypt, fetch_code: args.fetchCode, meta: 1 });

    return inspection$
        .catch(function (err) {
            if (err.statusCode >= 500) throw Cli.error.serverError(err.message);
            if (err.statusCode >= 400) throw Cli.error.badRequest(err.message);

            throw err;
        })
        .then(onTokenData);


    function onTokenData(data) {
        if (args.output === 'json') {
            console.log(JSON.stringify(data, null, 2));
        } else {
            PrintTokenDetails(data);
        }
    }
}
