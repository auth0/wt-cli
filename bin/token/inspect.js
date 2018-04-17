var Cli = require('structured-cli');
var Decode = require('jwt-decode');
var PrintTokenDetails = require('../../lib/printTokenDetails');
var PrintWebtaskDetails = require('../../lib/printWebtaskDetails');
var node4Migration = require('../../lib/node4Migration');


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
            'node8': {
                description: 'Edit a copy of the webtask in Node 8',
                dest: 'node8',
                type: 'boolean',                
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

    if (args.node8) {
        if (node4Migration.isNode4Profile(profile)) {
            args.profile.url = node4Migration.node8BaseUrl;
        }
        else {
            throw new Cli.error.invalid('The --node8 option can only be used with webtasks created in the legacy Node 4 webtask.io environment.');
        }
    }

    var claims;

    try {
        claims = Decode(args.subject);
    } catch (__) { }

    if (claims && profile.securityVersion !== 'v1') {
        throw Cli.error.invalid('The `wt token inspect` command for webtask tokens is not supported by the target service security configuration.');
    }

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
        } else if (profile.securityVersion === 'v1') {
            PrintTokenDetails(data);
        }
        else {
            PrintWebtaskDetails(data);
        }
    }
}
