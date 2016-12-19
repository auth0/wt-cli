'use strict';

const Chalk = require('chalk');
const Cli = require('structured-cli');
const _ = require('lodash');


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
    const modules = args['name@version'].reduce((acc, spec) => {
        const idx = spec.indexOf('@', 1);

        if (idx < 0) {
            return 
        }

        return acc;
    }, []);


    console.log(args);

    return;

    const profile = args.profile;
    const modules$ = profile.searchModules({ query: args.query });

    return modules$
        .then(onListing);

    
    function onListing(modules) {
        if (args.output === 'json') {
            console.log(JSON.stringify(modules, null, 2));
            return;
        }

        if (!modules.length) {
            console.log(Chalk.green(`No modules found matching the term: ${Chalk.bold(args.query)}*`));
            return;
        }

        const moduleVersions = modules.reduce((acc, entry) => {
            if (!acc[entry.name]) {
                acc[entry.name] = [];
            }

            acc[entry.name].push(entry.version);

            return acc;
        }, {});

        const modulesCount = Object.keys(moduleVersions).length;
        const modulePluralization = modulesCount === 1 ? 'module' : 'modules';

        console.log(Chalk.green(`Found ${Chalk.bold(modulesCount)} matching ${modulePluralization} for the term: ${Chalk.bold(args.query)}*`));

        Object.keys(moduleVersions).forEach(name => {
            const versions = moduleVersions[name];

            console.log(`${Chalk.bold(name)}: ${versions.join(', ')}`);
        });
    }
}
