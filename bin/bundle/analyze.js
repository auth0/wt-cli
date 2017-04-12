var Cli = require('structured-cli');
var Path = require('path');


module.exports = Cli.createCommand('analyze', {
    description: '[DEPRECATED] Specify dependencies via package.json',
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
    return Cli.errors.invalid('This command is deprecated');
}
