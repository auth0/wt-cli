var Chalk = require('chalk');
var Cli = require('structured-cli');
var Acls = require('../../lib/acls');
var Crypto = require('crypto');


module.exports = Cli.createCommand('get', {
    description: 'Get user permissions',
    plugins: [
        require('../_plugins/profile'),
    ],
    optionGroups: {
        'Output options': {
            'output': {
                alias: 'o',
                description: 'Set the output format',
                choices: ['json'],
                type: 'string',
            },
        },
    },
    params: {
        'user': {
            description: 'User to get',
            type: 'string',
        },
    },
    handler: handleUserGet,
});


// Command handler

function handleUserGet(args) {
    var profile = args.profile;
    args.user_hash = Crypto.createHash('md5').update(args.user || '').digest('hex');

    return Acls.getUser(args.user_hash, args.profile, true)
        .then(function (user) {
            if (args.output === 'json') {
                console.log(JSON.stringify(user, null, 2));
            }
            else if (user) {
                Acls.printUserLong(args.user, user);
            }
            else {
                console.log(Chalk.red('User not found.'));
            }
        });
}
