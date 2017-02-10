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
            'version': {
                alias: 'v',
                description: 'Use the previous version of the editor',
                dest: 'version',
                choices: ['v1', 'v2'],
                type: 'string',
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

    if (args.version) {
        url = profile.url + (args.version === `v1` ? '/prev' : '') + '/edit/' + profile.container + '#/' + wtName + profile.token;
    }

    console.log('Attempting to open the following url in your browser: ');
    console.log();
    console.log(Chalk.underline(url));
    console.log();
    console.log('If the webtask editor does not automatically open, please copy this address and paste it into your browser.');
    
    return Open(url, { wait: false });
}