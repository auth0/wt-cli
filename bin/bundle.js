var Cli = require('structured-cli');


var category = module.exports = Cli.createCategory('bundle', {
    description: 'Operations for working with bundled webtasks',
});

category.addChild(require('./bundle/analyze'));
category.addChild(require('./bundle/sync'));
category.addChild(require('./npm/npm'));
