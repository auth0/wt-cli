var Category = require('./category');
var Util = require('util');
var _ = require('lodash');


module.exports = App;


function App(options) {
    Category.call(this, 'app', options);
}

Util.inherits(App, Category);
