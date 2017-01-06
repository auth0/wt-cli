'use strict';

const Bluebird = require('bluebird');
const Chalk = require('chalk');
const Cli = require('structured-cli');
const Modules = require('../../lib/modules');


module.exports = Cli.createCommand('add', {
    description: 'Add modules to the webtask platform',
    plugins: [
        require('../_plugins/profile'),
    ],
    handler: handleModulesSearch,
    optionGroups: {
        'Modules options': {
            'env': {
                type: 'string',
                defaultValue: 'node',
                choices: ['node'],
                description: 'Select the runtime for modules',
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

function handleModulesSearch(args) {
    const specs = args['name@version'];
    const profile = args.profile;
    const stateToColor = {
        queued: Chalk.blue,
        available: Chalk.green,
        failed: Chalk.red,
    };

    return Bluebird
        .map(specs, Modules.parseSpec)
        .map(Modules.resolveSpec)
        .then(modules => Modules.ensure(profile, modules))
        .tap(modules => {
            console.log(Chalk.green('Modules add request completed'));

            modules.forEach(module => {
                const color = stateToColor[module.state] || Chalk.white;

                console.log(`${Chalk.bold(module.name)}@${Chalk.bold(module.version)}: ${color(module.state)}`);
            });
        });
}
