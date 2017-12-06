var Cli = require('structured-cli');


var category = module.exports = Cli.createCategory('group', {
    description: 'Manage groups',
});

category.addChild(require('./group/ls'));
category.addChild(require('./group/get'));
category.addChild(require('./group/create'));
category.addChild(require('./group/update'));
category.addChild(require('./group/rm'));