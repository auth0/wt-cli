var Cli = require('structured-cli');

var category = module.exports = Cli.createCategory('modules', {
    description: 'Provides submodule management commands',
});

category.addChild(require('./modules/install'));
