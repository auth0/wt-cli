var Chalk = require('chalk');
var Cli = require('structured-cli');
var Open = require('opn');


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
    optionGroups: {
        'Output options': {
            'previous-version': {
                description: 'Use the previous version of the editor',
                dest: 'previousVersion',
                type: 'boolean',
            },
        }
    },
    handler: handleEdit,
});


// Command handler

function handleEdit(args) {
    var profile = args.profile;
    var wtName  = args.name ? args.name + '/' : '';
    var url     = profile.url + '/edit/' + profile.container + '#/' + wtName + profile.token;

    if (args.previousVersion) {
        url = profile.url + '/prev/edit/' + profile.container + '#/' + wtName + profile.token;
    }

    console.log('Attempting to open the following url in your browser: ');
    console.log();
    console.log(Chalk.underline(url));
    console.log();
    console.log('If the webtask editor does not automatically open, please copy this address and paste it into your browser.');
    
    return Open(url, { wait: false });
}