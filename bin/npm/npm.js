var Cli = require('structured-cli');

var category = module.exports = Cli.createCategory('npm', {
    description: 'Provides commands that allow using npm',
});

category.addChild(require('./install'));
