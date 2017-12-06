var Cli = require('structured-cli');


var category = module.exports = Cli.createCategory('user', {
    description: 'Manage users',
});

category.addChild(require('./user/ls'));
category.addChild(require('./user/get'));
category.addChild(require('./user/create'));
category.addChild(require('./user/update'));
category.addChild(require('./user/rm'));