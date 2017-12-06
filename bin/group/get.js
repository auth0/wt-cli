var Chalk = require('chalk');
var Cli = require('structured-cli');
var Acls = require('../../lib/acls');
var _ = require('lodash');


module.exports = Cli.createCommand('get', {
    description: 'Get group details',
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
            'users': {
                alias: 'u',
                description: 'Show group membership',
                type: 'boolean',
            },
        },
    },
    params: {
        'group': {
            description: 'Group to get',
            type: 'string',
        },
    },
    handler: handleGroupGet,
});


// Command handler

function handleGroupGet(args) {
    var profile = args.profile;

    return Acls.getGroup(args.group, args.profile, args.users)
        .then(function (acls) {
            if (args.output === 'json') {
                console.log(JSON.stringify(acls, null, 2));
            }
            else if (acls) {
                Acls.printGroup(args.group, acls);
            }
            else {
                console.log(Chalk.red('Group not found.'));
            }
        });
}
