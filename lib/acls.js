var Bluebird = require('bluebird');
var Errors = require('./errors');
var Superagent = require('superagent');
var Url = require('url');
var Chalk = require('chalk');
var Cli = require('structured-cli');
var Crypto = require('crypto');

exports.getGroups = function (profile) {
    var u = Url.parse(profile.url);
    u.pathname = '/api/acl/groups';
    return Superagent
        .get(Url.format(u))
        .set('Authorization', `Bearer ${profile.token}`)
        .then(res => {
            return Promise.resolve(res.body);
        });
};

exports.getGroup = function (groupName, profile, resolveUsers) {
    var u = Url.parse(profile.url);
    u.pathname = `/api/acl/groups/${groupName}`;
    return Superagent
        .get(Url.format(u))
        .set('Authorization', `Bearer ${profile.token}`)
        .ok(res => res.status === 200 || res.status === 404)
        .then(res => {
            if (res.status === 404) {
                return Promise.resolve(null);
            }
            else if (!resolveUsers) {
                return Promise.resolve(res.body);
            }

            res.body.users = {};
            return exports.getUsers(profile)
                .then(users => {
                    for (var i in users) {
                        var user = users[i];
                        if (user.groups && user.groups.indexOf(groupName) > -1) {
                            res.body.users[i] = user;
                        }
                    }
                    return Promise.resolve(res.body);
                });
        });
};

exports.postGroup = function (profile, group) {
    var u = Url.parse(profile.url);
    u.pathname = '/api/acl/groups';
    return Superagent
        .post(Url.format(u))
        .set('Authorization', `Bearer ${profile.token}`)
        .send(group);
};

exports.removeGroup = function (groupName, profile) {
    var u = Url.parse(profile.url);
    u.pathname = `/api/acl/groups/${groupName}`;
    return Superagent
        .delete(Url.format(u))
        .set('Authorization', `Bearer ${profile.token}`);
};

exports.getUsers = function (profile) {
    var u = Url.parse(profile.url);
    u.pathname = '/api/acl/users';
    return Superagent
        .get(Url.format(u))
        .set('Authorization', `Bearer ${profile.token}`)
        .then(res => {
            return Promise.resolve(res.body);
        });
};

exports.getUser = function (hash, profile, resolveGroups) {
    var u = Url.parse(profile.url);
    u.pathname = `/api/acl/users/${hash}`;
    return Superagent
        .get(Url.format(u))
        .set('Authorization', `Bearer ${profile.token}`)
        .ok(res => res.status === 200 || res.status === 404)
        .then(res => {
            if (res.status === 404) {
                return Promise.resolve(null);
            }
            else if (!resolveGroups) {
                return Promise.resolve(res.body);
            }

            var groups = {};
            var $groups = [];
            if (res.body.groups) {
                res.body.groups.forEach(g => {
                    var u1 = Url.parse(profile.url);
                    u1.pathname = `/api/acl/groups/${g}`;
                    var $getGroup = Superagent
                        .get(Url.format(u1))
                        .set('Authorization', `Bearer ${profile.token}`)
                        .ok(res1 => res1.status === 200 || res1.status === 404)
                        .then(res1 => {
                            groups[g] = res1.status === 200 ? res1.body : {};
                        })
                    $groups.push($getGroup);
                });
            }

            return Promise.all($groups)
                .then(_ => {
                    res.body.groups = groups;
                    return Promise.resolve(res.body);
                });
        });
};

exports.postUser = function (profile, user) {
    var u = Url.parse(profile.url);
    u.pathname = '/api/acl/users';
    return Superagent
        .post(Url.format(u))
        .set('Authorization', `Bearer ${profile.token}`)
        .send(user);
};

exports.removeUser = function (hash, profile) {
    var u = Url.parse(profile.url);
    u.pathname = `/api/acl/users/${hash}`;
    return Superagent
        .delete(Url.format(u))
        .set('Authorization', `Bearer ${profile.token}`);
};

exports.printUserShort = function (userName, user) {
    console.log(Chalk.bold(`${userName}:`));
    var permissions = exports.getEffectivePermissions(userName, user);
    if (permissions.admin.length > 0) {
        console.log(Chalk.blue('  Admin:'), 'yes');
    }
    if (Object.keys(permissions.containers).length > 0) {
        console.log(Chalk.blue('  Containers:'), Object.keys(permissions.containers).sort().join(', '))
    }
    if (Object.keys(permissions.other).length > 0) {
        console.log(Chalk.blue('  Other:'), Object.keys(permissions.other).sort().join(', '))
    }
    if (permissions.admin.length === 0
      && Object.keys(permissions.containers).length === 0
      && Object.keys(permissions.other).length === 0) {
        console.log(Chalk.yellow('  No direct permissions'));
    }
    if (user.groups && user.groups.length > 0) {
        console.log(Chalk.blue('  Groups:'), user.groups.sort().join(', '))   
    }
};

exports.printGroup = function (groupName, acls) {
    console.log(Chalk.bold(`${groupName}:`));
    var permissions = getGroupPermissions(groupName, acls);
    if (permissions.admin.length === 0
      && Object.keys(permissions.containers).length === 0
      && Object.keys(permissions.other).length === 0) {
        console.log(Chalk.yellow('  No permissions'));
    }
    else {
        console.log(Chalk.blue('  Permissions:'));
    }
    if (permissions.admin.length > 0) {
        console.log(Chalk.blue('    Admin:'), 'yes');
    }
    if (Object.keys(permissions.containers).length > 0) {
        console.log(Chalk.blue('    Containers:'), Object.keys(permissions.containers).sort().join(', '))
    }
    if (Object.keys(permissions.other).length > 0) {
        console.log(Chalk.blue('    Other:'), Object.keys(permissions.other).sort().join(', '))
    }
    if (acls.users) {
        var users = Object.keys(acls.users).sort();
        if (users.length === 0) {
            console.log(Chalk.yellow('  No users'));
        }
        else {
            console.log(Chalk.blue('  Users:'));
            users.forEach(u => console.log(`    ${u}`));
        }
    }
};

exports.printUserLong = function (userName, user) {
    if (!user) {
        throw new Cli.error.hint(Chalk.red('User not found.'));
    }
    console.log(Chalk.bold(`${userName}:`));
    var permissions = exports.getEffectivePermissions(userName, user, true);
    if (permissions.admin.length > 0) {
        console.log(Chalk.blue('  Admin:'), 'yes', `(via ${permissions.admin.join(', ')})`);
    }
    if (Object.keys(permissions.containers).length > 0) {
        console.log(Chalk.blue('  Containers:'));
        Object.keys(permissions.containers).sort().forEach(c => {
            console.log(`    ${c} (via ${permissions.containers[c].join(', ')})`);
        });
    }
    if (Object.keys(permissions.other).length > 0) {
        console.log(Chalk.blue('  Other:'));
        Object.keys(permissions.other).sort().forEach(c => {
            console.log(`    ${c} (via ${permissions.other[c].join(', ')})`);
        });
    }
    if (permissions.admin.length === 0
      && Object.keys(permissions.containers).length === 0
      && Object.keys(permissions.other).length === 0) {
        console.log(Chalk.yellow('  No effective permissions'));
    }
    var groups = Object.keys(user.groups || {}).sort();
    if (groups.length > 0) {
        console.log(Chalk.blue('  Groups:'), groups.join(', '))   
    }
};

exports.getEffectivePermissions = function (userName, user, includeGroups) {
    var result = {
        containers: {},
        admin: [],
        other: {},
    };

    processPermissions('direct user permission', user.permissions || [], result);
    if (includeGroups && user.groups) {
        Object.keys(user.groups).forEach(g => {
            processPermissions(g, user.groups[g].permissions || [], result);
        });
    }

    return result;
};

function getGroupPermissions (groupName, group) {
    var result = {
        containers: {},
        admin: [],
        other: {},
    };

    processPermissions(groupName, group.permissions || [], result);

    return result;
};

function getGroupUsers (groupName, acls) {
    var users = [];
    for (var userName in acls.users) {
        var user = acls.users[userName];
        if (user.groups && user.groups.indexOf(groupName) > -1) {
            users.push(userName);
        }
    }

    return users.sort();
};

function processPermissions(source, permissions, result) {
    permissions.forEach(p => {
        if (p === 'wt:admin') {
            result.admin.push(source);
        }
        else {
            var match = p.match(/^wt\:owner\:(.+)$/);
            if (match) {
                result.containers[match[1]] = result.containers[match[1]] || [];
                result.containers[match[1]].push(source);
            }
            else {
                result.other[p] = result.other[p] || [];
                result.other[p].push(source);
            }
        }
    });
}

exports.handleGroupGrant = function (args, isUpdate) {
    var profile = args.profile;

    return exports.getGroup(args.group, args.profile, false)
        .then(function (group) {
            if (!group) {
                if (isUpdate) {
                    throw Cli.error.hint(Chalk.red("Group not found. Use `wt group create` to create one."));
                }
                group = { name: args.group };
            }

            var permissions = group.permissions || [];
            args.add_containers.forEach(c => add_permission(`wt:owner:${c}`, permissions));
            if (args.add_admin) {
                add_permission(`wt:admin`, permissions);
            }
            if (args.add_offline) {
                add_permission(`offline_access`, permissions);
            }
            if (args.remove_containers) {
                args.remove_containers.forEach(c => remove_permission(`wt:owner:${c}`, permissions));
            }
            if (args.remove_admin) {
                remove_permission(`wt:admin`, permissions);
            }
            if (args.remove_offline) {
                remove_permission(`offline_access`, permissions);
            }

            if (permissions.length === 0) {
                delete group.permissions;
            }
            else if (!group.permissions) {
                group.permissions = permissions;
            }

            var $updates = [];
            $updates.push(exports.postGroup(args.profile, group));

            args.add_users.forEach(u => {
                var user_hash = Crypto.createHash('md5').update(u).digest('hex');
                var $userUpdate = exports.getUser(user_hash, args.profile)
                    .then(user => {
                        if (!user) user = { name: u };
                        user.groups = user.groups || [];
                        add_permission(args.group, user.groups)
                        return exports.postUser(args.profile, user);
                    });
                $updates.push($userUpdate);
            });
            if (args.remove_users) {
                args.remove_users.forEach(u => {
                    var user_hash = Crypto.createHash('md5').update(u).digest('hex');
                    var $userUpdate = exports.getUser(user_hash, args.profile)
                        .then(user => {
                            if (user && user.groups) {
                                remove_permission(args.group, user.groups);
                                if (user.groups.length === 0) {
                                    delete user.groups;
                                }
                                return exports.postUser(args.profile, user);
                            }
                        });
                    $updates.push($userUpdate);
                });
            }

            return Promise.all($updates)
                .then(_ => {
                    exports.printGroup(args.group, group);
                });
        });
};


exports.handleUserGrant = function (args, isUpdate) {
    var profile = args.profile;
    args.user_hash = Crypto.createHash('md5').update(args.user || '').digest('hex');
    return exports.getUser(args.user_hash, args.profile)
        .then(function (user) {
            if (!user) {
                if (isUpdate) {
                    throw Cli.error.hint(Chalk.red("User not found. Use `wt user create` to create one."));
                }
                user = { name: args.user };
            }

            var permissions = user.permissions || [];
            args.add_containers.forEach(c => add_permission(`wt:owner:${c}`, permissions));
            if (args.add_admin) {
                add_permission(`wt:admin`, permissions);
            }
            if (args.add_offline) {
                add_permission(`offline_access`, permissions);
            }
            if (args.remove_containers) {
                args.remove_containers.forEach(c => remove_permission(`wt:owner:${c}`, permissions));
            }
            if (args.remove_admin) {
                remove_permission(`wt:admin`, permissions);
            }
            if (args.remove_offline) {
                remove_permission(`offline_access`, permissions);
            }

            if (permissions.length === 0) {
                delete user.permissions;
            }
            else if (!user.permissions) {
                user.permissions = permissions;
            }

            var groups = user.groups || [];
            args.add_groups.forEach(g => add_permission(g, groups));
            if (args.remove_groups) {
                args.remove_groups.forEach(g => remove_permission(g, groups));
            }
            if (groups.length === 0) {
                delete user.groups;
            }
            else if (!user.groups) {
                user.groups = groups;
            }

            return exports.postUser(args.profile, user)
                .then(res => {
                    exports.printUserShort(args.user, user);
                });

        });
};

exports.addPermissionArgs = function (permissions, cmd) {
    if (permissions) {
        permissions.forEach(p => {
            if (p === 'wt:admin') {
                cmd.push('-aa')
            }
            else if (p === 'offline_access') {
                cmd.push('-ao');
            }
            else {
                var match = p.match(/^wt\:owner\:(.+)$/);
                if (match) {
                    cmd.push(`-ac ${match[1]}`);
                }
            }
        });
    }
};


function add_permission(permission, permissions) {
    if (permissions.indexOf(permission) < 0) {
        permissions.push(permission);
    }
}

function remove_permission(permission, permissions) {
    var i = permissions.indexOf(permission);
    if (i > -1) {
        permissions.splice(i, 1);
    }
}
