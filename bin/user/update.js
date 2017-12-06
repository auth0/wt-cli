var Chalk = require('chalk');
var Cli = require('structured-cli');
var Acls = require('../../lib/acls');
var _ = require('lodash');


module.exports = Cli.createCommand('update', {
    description: 'Update user permissions',
    plugins: [
        require('../_plugins/profile'),
    ],
    optionGroups: {
        'User creation': {
            'add-container': {
                action: 'append',
                alias: 'ac',
                metavar: 'CONTAINER',
                defaultValue: [],
                description: 'Container the user can manage',
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
                description: 'User can get refresh token',
                alias: 'ao',
                dest: 'add_offline',
                type: 'boolean',
            },
            'add-group': {
                action: 'append',
                alias: 'ag',
                metavar: 'GROUP',
                defaultValue: [],
                description: 'Group to add the user to',
                dest: 'add_groups',
                type: 'string',
            },
            'remove-container': {
                action: 'append',
                alias: 'rc',
                metavar: 'CONTAINER',
                defaultValue: [],
                description: 'Container the user cannot manage any more',
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
                description: 'User cannot get refresh token',
                alias: 'ro',
                dest: 'remove_offline',
                type: 'boolean',
            },
            'remove-group': {
                action: 'append',
                alias: 'rg',
                metavar: 'GROUP',
                defaultValue: [],
                description: 'Groups(s) to remove the user from',
                dest: 'remove_groups',
                type: 'string',
            },
        }
    },
    params: {
        'user': {
            description: 'User to update',
            type: 'string',
        },
    },
    handler: args => Acls.handleUserGrant(args, true),
});
