var Chalk = require('chalk');
var Checker = require('webtask-bundle/lib/checker');
var Cli = require('structured-cli');
var Path = require('path');


module.exports = Cli.createCommand('sync', {
    description: 'Update the version of each module in your package.json with the closest version available on webtask.io',
    plugins: [
        // require('../_plugins/profile'),
    ],
    optionGroups: {
        'Synchronization options': {
            interactive: {
                alias: 'i',
                description: 'Interactively prompt you for which packages to synchronize and which to leave untouched.',
                type: 'boolean',
            },
        },
    },
    params: {
        'filename': {
            description: 'Path to the webtask\'s code.',
            type: 'string',
            defaultValue: Path.join(process.cwd(), 'webtask.js'),
        },
    },
    handler: handleBundleAnalyze,
});


// Command handler

function handleBundleAnalyze(args) {
    var sync$ = Checker.sync({
        entry: args.filename,
        interactive: args.interactive,
    });
    
    return sync$.toPromise();
}
