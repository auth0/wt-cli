var App = require('./app');
var Category = require('./category');
var Command = require('./command');


exports.app = createApp;
exports.category = createCategory;
exports.command = createCommand;


function createApp(options) {
    return new App(options);
}

function createCategory(name, options) {
    return new Category(name, options);
}

function createCommand(name, options) {
    return new Command(name, options);
}
