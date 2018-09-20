var Chalk = require('chalk');
var Cli = require('structured-cli');
var Open = require('opn');


module.exports = Cli.createCommand('browse', {
    description: 'Browse this webtask in your browser (HTTP GET)',
    plugins: [
        require('./_plugins/profile'),
    ],
    params: {
        'name': {
            description: 'The named webtask you want to browse',
            type: 'string',
            required: true
        },
    },
    handler: handleBrowse,
});


// Command handler

function handleBrowse(args) {
    var profile = args.profile;
    var wtName  = args.name ? args.name + '/' : '';
    var url     = profile.url + '/api/run/' + profile.container + '/' + wtName;

    console.log('Browsing ' + Chalk.underline(args.name) + ' in your browser...');

    Open(url, { wait: false });
}
