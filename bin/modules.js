var Cli = require('structured-cli');


var category = module.exports = Cli.createCategory('modules', {
    description: 'Manage and search modules available on the platform',
});

category.addChild(require('./modules/add'));
category.addChild(require('./modules/inspect'));
