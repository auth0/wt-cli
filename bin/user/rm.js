var Cli = require('structured-cli');
var Acls = require('../../lib/acls');
var Chalk = require('chalk');
var Crypto = require('crypto');


module.exports = Cli.createCommand('rm', {
    description: 'Remove a user',
    plugins: [
        require('../_plugins/profile'),
    ],
    params: {
        'user': {
            description: 'User to remove',
            type: 'string',
        },
    },
    handler: handleUserRemove,
});

function handleUserRemove (args) {
    args.user_hash = Crypto.createHash('md5').update(args.user || '').digest('hex');
    return Acls.getUser(args.user_hash, args.profile)
        .then(function (user) {
            if (!user) {
                throw Cli.error.hint(Chalk.red("User not found."));
            }

            return Acls.removeUser(args.user_hash, args.profile)
                .then(res => {
                    var cmd = ['wt user create', args.user];
                    if (user.groups) {
                        user.groups.forEach(g => cmd.push(`-ag ${g}`));
                    }
                    Acls.addPermissionArgs(user.permissions, cmd);

                    console.log(Chalk.green('User removed. To recreate with the same permissions and group membership, run:'));
                    console.log(cmd.join(' '));
                });
        });
}
