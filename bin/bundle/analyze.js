var Chalk = require('chalk');
var Checker = require('webtask-bundle/lib/checker');
var Cli = require('structured-cli');
var Path = require('path');


module.exports = Cli.createCommand('analyze', {
    description: 'Compare the module dependencies of your webtask with modules on the Webtask platform',
    plugins: [
        // require('../_plugins/profile'),
    ],
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
    var check$ = Checker.check({
        entry: args.filename,
    });
    
    return check$.toPromise();
}
