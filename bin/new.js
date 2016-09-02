var Chalk = require('chalk');
var Cli = require('structured-cli');
var Open = require('open');


module.exports = Cli.createCommand('new', {
    description: 'Create a new webtask using wt-editor in your browser',
    plugins: [
        require('./_plugins/profile'),
    ],
    handler: handleNew,
});


// Command handler

function handleNew(args) {
    var profile = args.profile;
    var url = profile.url + '/edit/' + profile.container + '#/' + profile.token;
    console.log('Opening ' + Chalk.underline(args.name) + ' in your browser...');
    
    Open(url);
}