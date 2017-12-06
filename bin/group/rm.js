var Cli = require('structured-cli');
var Acls = require('../../lib/acls');
var Chalk = require('chalk');


module.exports = Cli.createCommand('rm', {
    description: 'Remove a group',
    plugins: [
        require('../_plugins/profile'),
    ],
    params: {
        'group': {
            description: 'Group to remove',
            type: 'string',
        },
    },
    handler: handleGroupRemove,
});

function handleGroupRemove (args) {
    return Acls.getGroup(args.group, args.profile)
        .then(function (group) {
            if (!group) {
                throw Cli.error.hint(Chalk.red("Group not found."));
            }

            var cmd = ['wt group create', args.group];
            Acls.addPermissionArgs(group.permissions, cmd);

            var $updates = [];
            $updates.push(Acls.removeGroup(args.group, args.profile));

            return Acls.getUsers(args.profile)
                .then(users => {
                    for (var u in users) {
                        var user = users[u];
                        if (user.groups) {
                            var i = user.groups.indexOf(args.group);
                            if (i > -1) {
                                user.groups.splice(i, 1);
                                if (user.groups.length === 0) {
                                    delete user.groups;
                                }
                                var newUser = { name: u };
                                if (user.permissions) newUser.permissions = user.permissions;
                                if (user.groups) newUser.groups = user.groups;
                                cmd.push(`-au ${u}`);
                                $updates.push(Acls.postUser(args.profile, newUser));
                            }
                        }
                    }
                    return Promise.all($updates)
                        .then(_ => {
                            console.log(Chalk.green('Group removed. To recreate with the same permissions and membership, run:'));
                            console.log(cmd.join(' '));
                        })
                });
        });
}
