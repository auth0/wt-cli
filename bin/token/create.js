var Chalk = require('chalk');
var Cli = require('structured-cli');
var _ = require('lodash');


var RAW_CLAIMS = {
    ten: {
        type: 'string', 
    },
    dd: {
        type: 'int',
    },
    'code-url': {
        type: 'string', 
    },
    code: {
        type: 'string',
        description: '',
    },
    ectx: {
        action: 'append',
        defaultValue: null,
        metavar: 'KEY=VALUE',
        type: 'string',
    },
    pctx: {
        action: 'append',
        defaultValue: null,
        metavar: 'KEY=VALUE',
        type: 'string',
    },
    nbf: {
        type: 'string',
    },
    exp: {
        type: 'string',
    },
    host: {
        type: 'string'
    },
    mb: {
        type: 'boolean',
    },
    pb: {
        type: 'int',
    },
    dr: {
        type: 'boolean',
    },
    jtn: {
        type: 'string',
    },
    ls: {
        type: 'string',
    },
    lm: {
        type: 'string',
    },
    lh: {
        type: 'string',
    },
    ld: {
        type: 'string',
    },
    lw: {
        type: 'string',
    },
    lo: {
        type: 'string',
    },
    lts: {
        type: 'string',
    },
    ltm: {
        type: 'string',
    },
    lth: {
        type: 'string',
    },
    ltd: {
        type: 'string',
    },
    ltw: {
        type: 'string',
    },
    lto: {
        type: 'string',
    },
};

module.exports = Cli.createCommand('create', {
    description: 'Create webtask tokens',
    plugins: [
        require('../_plugins/profile'),
    ],
    optionGroups: {
        'Token claims': RAW_CLAIMS,
        'Output options': {
            output: {
                alias: 'o',
                description: 'Set the output format',
                choices: ['json'],
                type: 'string',
            },
        },
    },
    options: {
        claims: {
            type: 'string',
            description: 'Provide your own base set of claims as a JSON string'
        },
    },
    epilog: Chalk.bold('For detailed information on creating webtask tokens, see: https://webtask.io/docs/api_issue'),
    handler: handleTokenCreate,
});


// Command handler

function handleTokenCreate(args) {
    var profile = args.profile;

    if (profile.securityVersion !== 'v1') {
        throw Cli.error.invalid('The `wt token create` command is not supported by the target service security configuration.');
    }

    var claims = _.pick(_.pickBy(args, v => v !== null), Object.keys(RAW_CLAIMS));
    
    if (claims['code-url']) {
        claims.url = claims['code-url'];
        delete claims['code-url'];
    }
    
    if (claims.dr) claims.dr = 1;
    else delete claims.dr;
    
    if (claims.mb) claims.mb = 1;
    else delete claims.mb;
        
    if (args.claims) {
        try {
            claims = _.defaultsDeep(claims, JSON.parse(args.claims));
        } catch (e) {
            throw Cli.error.invalid('Invalid JSON supplied in `claims` option');
        }
    }
    
    if (claims.ectx) claims.ectx = parseTuples(claims.ectx);
    if (claims.pctx) claims.pctx = parseTuples(claims.pctx);

    return profile.createTokenRaw(claims)
        .catch(function (err) {
            if (err.statusCode >= 500) throw Cli.error.serverError(err.message);
            if (err.statusCode >= 400) throw Cli.error.badRequest(err.message);
            
            throw err;
        })
        .then(onToken);

    
    function onToken(token) {
        console.log(args.output === 'json' ? JSON.stringify(token) : token);
    }
    
    function parseTuples(tuples) {
        return _(tuples)
            .map(_.method('split', /,\s*/))
            .flatten()
            .reduce(function (secrets, tuple) {
                var parts = tuple.split('=');
                
                return _.set(secrets, parts.shift(), parts.join('='));
            }, {});
    }
}