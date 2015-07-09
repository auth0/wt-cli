var Cli = require('nested-yargs');
var Profile = require('./profile');

// Init is actually just an alias to `wt profile init`.
module.exports = Cli.createCommand('init', 'Ready, set, webtask!',
    Profile.commands.init.options);
