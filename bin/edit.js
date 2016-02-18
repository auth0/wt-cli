var Cli = require('structured-cli');
var Open = require('open');
var _ = require('lodash');


module.exports = Cli.createCommand('edit', {
    description: 'Edit this webtask in your browser',
    plugins: [
        require('./_plugins/profile'),
    ],
    params: {
        'name': {
            description: 'The named webtask you want to edit',
            type: 'string',
        },
    },
    handler: handleEdit,
});


// Command handler

function handleEdit(args) {
    var profile = args.profile;
    var url = profile.url + '/edit/webtask/' + profile.container + '/' + args.name + '#token=' + profile.token;
    
    console.log('Opening ' + url + ' in your browser...');
    
    Open(url);
}


