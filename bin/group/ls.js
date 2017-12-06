var Chalk = require('chalk');
var Cli = require('structured-cli');
var Acls = require('../../lib/acls');
var _ = require('lodash');


module.exports = Cli.createCommand('ls', {
    description: 'List groups with user and permissions',
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
    handler: handleGroupList,
});


// Command handler

function handleGroupList(args) {
    var profile = args.profile;

    return Acls.getGroups(args.profile)
        .then(function (acls) {
            if (args.output === 'json') {
                console.log(JSON.stringify(acls, null, 2));
            }
            else {
                printGroups(acls);
            }
        });
}

function printGroups(acls) {
    var groups = Object.keys(acls).sort();
    if (groups.length === 0) {
        console.log(Chalk.yellow('No groups exist. Define one with `wt group create`.'));
    }
    else {
        groups.forEach(g => {
            Acls.printGroup(g, acls[g]);
        });
    }
}
