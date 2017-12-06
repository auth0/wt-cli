var Chalk = require('chalk');
var Cli = require('structured-cli');
var Acls = require('../../lib/acls');
var _ = require('lodash');


module.exports = Cli.createCommand('update', {
    description: 'Update group permissions and membership',
    plugins: [
        require('../_plugins/profile'),
    ],
    optionGroups: {
        'Group update': {
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
            'remove-container': {
                action: 'append',
                alias: 'rc',
                metavar: 'CONTAINER',
                defaultValue: [],
                description: 'Container that group members can no longer manage',
                dest: 'remove_containers',
                type: 'string',
            },
            'remove-admin': {
                description: 'Remove admin permissions',
                alias: 'ra',
                dest: 'remove_admin',
                type: 'boolean',
            },
            'remove-offline': {
                description: 'Group members cannot get refresh token',
                alias: 'ro',
                dest: 'remove_offline',
                type: 'boolean',
            },
            'remove-user': {
                action: 'append',
                alias: 'ru',
                metavar: 'USER',
                defaultValue: [],
                description: 'User to remove from the group',
                dest: 'remove_users',
                type: 'string',
            },
        }
    },
    params: {
        'group': {
            description: 'Group to update',
            type: 'string',
        },
    },
    handler: args => Acls.handleGroupGrant(args, true),
});
