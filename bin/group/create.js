var Chalk = require('chalk');
var Cli = require('structured-cli');
var Acls = require('../../lib/acls');
var _ = require('lodash');


module.exports = Cli.createCommand('create', {
    description: 'Create a group',
    plugins: [
        require('../_plugins/profile'),
    ],
    optionGroups: {
        'Group creation': {
            'add-container': {
                action: 'append',
                alias: 'ac',
                metavar: 'CONTAINER',
                defaultValue: [],
                description: 'Container that group members can manage',
                dest: 'add_containers',
                type: 'string',
            },
            'add-admin': {
                description: 'Add admin permissions',
                alias: 'aa',
                dest: 'add_admin',
                type: 'boolean',
            },
            'add-offline': {
                description: 'Group members can get refresh token',
                alias: 'ao',
                dest: 'add_offline',
                type: 'boolean',
            },
            'add-user': {
                action: 'append',
                alias: 'au',
                metavar: 'USER',
                defaultValue: [],
                description: 'User to add to the group',
                dest: 'add_users',
                type: 'string',
            },
        }
    },
    params: {
        'group': {
            description: 'Group to create',
            type: 'string',
        },
    },
    handler: args => Acls.handleGroupGrant(args, false),
});
