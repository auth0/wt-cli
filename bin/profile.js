var Cli = require('structured-cli');


var category = module.exports = Cli.createCategory('profile', {
    description: 'Manage webtask profiles',
});

category.addChild(require('./profile/init'));
category.addChild(require('./profile/ls'));
category.addChild(require('./profile/get'));
category.addChild(require('./profile/rm'));
category.addChild(require('./profile/nuke'));
category.addChild(require('./profile/migrate'));
