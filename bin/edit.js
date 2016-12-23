var Chalk = require('chalk');
var Cli = require('structured-cli');
var Open = require('open');


module.exports = Cli.createCommand('edit', {
    description: 'Edit this webtask in your browser',
    plugins: [
        require('./_plugins/profile'),
    ],
    params: {
        'name': {
            description: 'The named webtask you want to edit',
            type: 'string',
            required: false
        },
    },
    handler: handleEdit,
});


// Command handler

function handleEdit(args) {
    var profile = args.profile;
    var wtName  = args.name ? args.name + '/' : '';
    var url     = profile.url + '/edit/' + profile.container + '#/' + wtName + profile.token;

    if (args.name) {
        console.log('Opening ' + Chalk.underline(args.name) + ' in your browser...');
    } else {
        console.log('Opening Webtask Editor');
    }
    console.log('If nothing happens, open this url: ' + url);
    Open(url);
}
