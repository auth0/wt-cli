'use strict';

const Bluebird = require('bluebird');
const Chalk = require('chalk');
const Cli = require('structured-cli');
const Modules = require('../../lib/modules');


module.exports = Cli.createCommand('add', {
    description: 'Add modules to the webtask platform',
    profileOptions: {
        hide: ['container'],
    },
    plugins: [
        require('../_plugins/profile'),
    ],
    handler: handleModulesAdd,
    optionGroups: {
        'Modules options': {
            'env': {
                type: 'string',
                defaultValue: 'node',
                choices: ['node'],
                description: 'Select the runtime for modules',
            },
            'rebuild': {
                alias: 'r',
                type: 'boolean',
                description: 'Queue the modules for rebuilding by the platform (administrator only)',
                dest: 'reset',
            },
            'wait': {
                alias: 'w',
                type: 'boolean',
                description: 'Wait for the modules to be available',
            },
        },
        'Output options': {
            output: {
                alias: 'o',
                description: 'Set the output format',
                choices: ['json'],
                type: 'string',
            },
        },
    },
    params: {
        'name@version': {
            description: 'A list of modules and versions to add to the platform',
            type: 'string',
            nargs: '+',
        },
    },
});


// Command handler

function handleModulesAdd(args) {
    const specs = args['name@version'];
    const profile = args.profile;
    const stateToColor = {
        queued: Chalk.blue,
        available: Chalk.green,
        failed: Chalk.red,
    };

    return Bluebird
        .map(specs, Modules.parseSpec)
        .tap(specs => {
            console.log('Adding the following modules to the platform:');
            specs.forEach(spec => {
                console.log(`  ${spec.name}@${spec.range}`);
            });
        })
        .map(spec => Modules.resolveSpec(profile, spec))
        .then(modules => args.wait
            ?   Modules.awaitAvailable(profile, modules, { reset: args.reset })
            :   Modules.ensure(profile, modules, { reset: args.reset }))
        .tap(modules => {
            console.log(Chalk.bold('Modules added:'));

            modules.forEach(module => {
                const color = stateToColor[module.state] || Chalk.white;

                console.log(`  ${Chalk.bold(module.name)}@${Chalk.bold(module.version)}: ${color(module.state)}`);
            });
        });
}
