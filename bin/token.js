var Cli = require('structured-cli');


var category = module.exports = Cli.createCategory('token', {
    description: 'Advanced operations on webtask tokens',
});

category.addChild(require('./token/create'));
category.addChild(require('./token/inspect'));
