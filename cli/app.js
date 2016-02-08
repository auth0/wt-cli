var ArgumentParser = require('argparse').ArgumentParser;
var Category = require('./category');
var Util = require('util');
var _ = require('lodash');


module.exports = App;


function App(options) {
    Category.call(this, 'app', options);
}

Util.inherits(App, Category);

App.prototype.run = function () {
    var parser = new ArgumentParser(_.defaults(this.options, {
        addHelp: true,
    }));
    
    this.configure(parser);
    
    var args = parser.parseArgs();
    
    if (!(typeof args.handler === 'function')) {
        parser.printHelp();
        process.exit(1);
    }
    
    args.handler(args);
};
