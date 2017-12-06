var Chalk = require('chalk');
var Cli = require('structured-cli');
var Acls = require('../../lib/acls');
var _ = require('lodash');


module.exports = Cli.createCommand('ls', {
    description: 'List users with permissions',
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
    handler: handleUserList,
});


// Command handler

function handleUserList(args) {
    var profile = args.profile;

    return Acls.getUsers(args.profile)
        .then(function (acls) {
            if (args.output === 'json') {
                console.log(JSON.stringify(acls, null, 2));
            }
            else {
                printUsers(acls);
            }
        });
}

function printUsers(acls) {
    Object.keys(acls).sort().forEach(u => {
        Acls.printUserShort(u, acls[u]);
    });
}
