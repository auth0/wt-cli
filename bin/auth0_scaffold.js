var Chalk = require('chalk');
var Cli = require('structured-cli');
var _ = require('lodash');
var keyValList2Object = require('../lib/keyValList2Object');
var auth0Extensions = require('./auth0_extensions');
var extensionTypes = Object.keys(auth0Extensions).sort();


module.exports = Cli.createCommand('scaffold', {
    description: 'Scaffold the Auth0 hook code',
    optionGroups: {
        'Hook scaffolding': {
            'type': {
                alias: 't',
                description: 'Hook type, required. One of: ' + extensionTypes.join(', ') + '.',
                choices: extensionTypes,
                required: true,
                dest: 'extensionName',
                metavar: 'TYPE',
                type: 'string'
            },
        }
    },
    handler: (args) => console.log(auth0Extensions[args.extensionName].template),
});

