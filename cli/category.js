var Assert = require('assert');
var Command = require('./command');
var Node = require('./node');
var Util = require('util');
var _ = require('lodash');



module.exports = Category;


function Category(name, options) {
    Node.call(this, name, options);
    
    this.children = [];
}

Util.inherits(Category, Node);

Category.prototype.addCategory = function (node) {
    Assert.ok(node instanceof Category, '`category` must be an instance of `Category`');
    
    this.children.push(node);

    node.setParent(this);
};

Category.prototype.addCommand = function (node) {
    Assert.ok(node instanceof Command, '`command` must be an instance of `Command`');
    
    this.children.push(node);

    node.setParent(this);
};

Category.prototype.configure = function (parser) {
    this.subparsers = parser.addSubparsers({
        descripion: this.options.description,
        dest: 'cat_' + this.name,
        title: 'subcommands',
    });
    
    this.children.forEach(configureChild, this);
    
    function configureChild(child) {
        var parser = this.subparsers.addParser(child.name, {
            addHelp: !!child.options.description,
            help: child.options.description,
        });
        
        child.configure(parser);
    }
};
