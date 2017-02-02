'use strict';

const Chalk = require('chalk');
const Cli = require('structured-cli');
const Semver = require('semver');


module.exports = Cli.createCommand('versions', {
    description: 'List the versions of of a module that are currently available on the platform',
    profileOptions: {
        hide: ['container'],
    },
    plugins: [
        require('../_plugins/profile'),
    ],
    handler: handleModuleVersions,
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
            description: 'The name of an npm module',
            type: 'string',
            required: true,
        },
    },
});


// Command handler

function handleModuleVersions(args) {
    const profile = args.profile;
    const modules$ = profile.listNodeModuleVersions({ name: args.name });
    const stateToColor = {
        queued: Chalk.blue,
        available: Chalk.green,
        failed: Chalk.red,
    };

    console.error(`Searching for the versions of ${Chalk.bold(args.name)} that are already available on the platform...`);

    return modules$
        .then(modules => modules.sort((a, b) => Semver.rcompare(a.version, b.version)))
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

        console.error(Chalk.green(`We found ${Chalk.bold(versionsCount)} ${versionsPluralization} for the module: ${Chalk.bold(args.name)}`));

        modules.forEach(module => {
            const color = stateToColor[module.state] || Chalk.white;
            console.log(`${Chalk.bold(module.version)}: ${color(module.state)}`);
        });
    }
}
