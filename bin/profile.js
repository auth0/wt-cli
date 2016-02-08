var Cli = require('../cli');


var category = module.exports = Cli.category('profile', {
    description: 'Manage webtask profiles',
});

category.addCommand(require('./profile/init'));
category.addCommand(require('./profile/ls'));
category.addCommand(require('./profile/get'));
category.addCommand(require('./profile/rm'));
category.addCommand(require('./profile/nuke'));
