'use strict';

const Chalk = require('chalk');
const Cli = require('structured-cli');
const _ = require('lodash');


module.exports = Cli.createCommand('inspect', {
    description: 'Inspect the versions of modules available on the platform',
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
        name: {
            description: 'The name of the npm module whose available and queued versions you would like to inspect',
            type: 'string',
            required: true,
        },
    },
});


// Command handler

function handleModulesSearch(args) {
    const profile = args.profile;
    const modules$ = profile.listVersions({ name: args.name });
    const stateToColor = {
        queued: Chalk.blue,
        available: Chalk.green,
        failed: Chalk.red,
    };

    return modules$
        .then(onListing);

    
    function onListing(modules) {
        if (args.output === 'json') {
            console.log(JSON.stringify(modules, null, 2));
            return;
        }

        if (!modules.length) {
            console.log(Chalk.green(`No versions found for the module: ${Chalk.bold(args.name)}`));
            return;
        }

        const versionsCount = modules.length;
        const versionsPluralization = versionsCount === 1 ? 'version' : 'versions';

        console.log(Chalk.green(`We found ${Chalk.bold(versionsCount)} ${versionsPluralization} for the module: ${Chalk.bold(args.name)}`));

        modules.forEach(module => {
            const color = stateToColor[module.state] || Chalk.white;
            console.log(`${Chalk.bold(module.version)}: ${color(module.state)}`);
        });
    }
}
