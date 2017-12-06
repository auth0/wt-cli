var Chalk = require('chalk');
var Cli = require('structured-cli');
var Acls = require('../../lib/acls');
var _ = require('lodash');


module.exports = Cli.createCommand('create', {
    description: 'Create a user',
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
        }
    },
    params: {
        'user': {
            description: 'User to create',
            type: 'string',
        },
    },
    handler: args => Acls.handleUserGrant(args, false),
});
