var Chalk = require('chalk');
var Cli = require('structured-cli');
var PrintWebtask = require('../lib/printWebtask');
var _ = require('lodash');
var keyValList2Object = require('../lib/keyValList2Object');
var node4Migration = require('../lib/node4Migration');


module.exports = Cli.createCommand('ls', {
    description: 'List named webtasks',
    plugins: [
        require('./_plugins/profile'),
    ],
    handler: handleTokenCreate,
    optionGroups: {
        'Pagination': {
            'offset': {
                type: 'int',
                description: 'Skip this many named webtasks',
                defaultValue: 0,
            },
            'limit': {
                type: 'int',
                description: 'Limit the results to this many named webtasks',
                defaultValue: 10,
            },
        },
        'Filtering': {
            'meta': {
                action: 'append',
                defaultValue: [],
                description: 'Metadata describing the webtask. This is a set of string key value pairs. Only webtasks with matching metadata will be returned.',
                dest: 'meta',
                metavar: 'KEY=VALUE',
                type: 'string',
            },

        },
        'Output options': {
            'output': {
                alias: 'o',
                description: 'Set the output format',
                choices: ['json'],
                type: 'string',
            },
            'details': {
                alias: 'd',
                description: 'Show more details',
                type: 'boolean',
            },
            'show-token': {
                description: 'Show the webtask tokens',
                dest: 'showToken',
                type: 'boolean',
            },
            'node8': {
                description: 'List webtasks copied to Node 8 environment',
                dest: 'node8',
                type: 'boolean',
            }

        },
    },
});


// Command handler

function handleTokenCreate(args) {
    var profile = args.profile;

    if (args.node8) {
        if (node4Migration.isNode4Profile(profile)) {
            profile.url = node4Migration.node8BaseUrl;
        }
        else {
            throw new Cli.error.invalid(Chalk.red(`The --node8 option can only be used with wt-cli profiles configured to use webtask.io Node 4 environment.`));
        }
    }

    keyValList2Object(args, 'meta');
    
    return profile.listWebtasks({ offset: args.offset, limit: args.limit, meta: args.meta })
        .catch(function (err) {
            if (err.statusCode >= 500) throw Cli.error.serverError(err.message);
            if (err.statusCode >= 400) throw Cli.error.badRequest(err.message);
            
            throw err;
        })
        .then(onWebtasks);
        
    
    function onWebtasks(webtasks) {
        if (args.output === 'json') {
            var output = webtasks.map(function (webtask) {
                var json = webtask.toJSON();
                var record = {
                    container: json.container,
                    name: json.name,
                    url: webtask.url,
                };
                if (webtask.meta) {
                    record.meta = webtask.meta
                }
                
                if (args.showToken) record.token = json.token;
                
                return record;
            });
            
            console.log(JSON.stringify(output, null, 2));
        } else {
            _.forEach(webtasks, function (webtask) {
                PrintWebtask(webtask, { details: args.details, token: args.showToken });
                console.log();
            });
            
            if (!webtasks.length) {
                if (args.offset) {
                    console.log('You have fewer than %s named webtasks.', Chalk.bold(args.offset));
                } else {
                    console.log(Chalk.green('You do not have any named webtasks. To get started, try:\n\n'
                        + Chalk.bold('$ echo "module.exports = function (cb) { cb(null, \'Hello\'); }" > hello.js\n')
                        + Chalk.bold('$ wt create hello.js\n')));
                }
            } else {
                if (webtasks.length === args.limit) {
                    console.log(Chalk.green('Successfully listed named webtasks %s to %s. To list more try:'), Chalk.bold(args.offset + 1), Chalk.bold(args.offset + webtasks.length));
                    console.log(Chalk.bold('$ wt ls --offset %d'), args.offset + args.limit);
                } else {
                    console.log(Chalk.green('Successfully listed named webtasks %s to %s.'), Chalk.bold(args.offset + 1), Chalk.bold(args.offset + webtasks.length));
                }
            }
        }
    }
}
