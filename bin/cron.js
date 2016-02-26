var Cli = require('structured-cli');


var category = module.exports = Cli.createCategory('cron', {
    description: 'Manage scheduled webtasks',
});

category.addChild(require('./cron/schedule'));
category.addChild(require('./cron/ls'));
category.addChild(require('./cron/get'));
category.addChild(require('./cron/rm'));
category.addChild(require('./cron/history'));
