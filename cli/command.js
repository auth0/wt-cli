var Assert = require('assert');
var Node = require('./node');
var Util = require('util');
var _ = require('lodash');



module.exports = Command;


function Command(name, options) {
    Node.call(this, name, options);
}

Util.inherits(Command, Node);

Command.prototype.configure = function (parser) {
    _.map(this.options.options, configureOption);
    _.map(this.options.params, configureParam);
        
    parser.setDefaults({ handler: this.options.handler });
    
    function configureOption(options, name) {
        var switches = ['--' + name];
        
        if (options.alias) switches.push('-' + options.alias);
        
        parser.addArgument(switches, {
            action: options.type !== 'boolean' ? 'store' : 'storeTrue',
            defaultValue: options.defaultValue,
            // type: options.type === 'boolean' ? 'bool' : options.type,
            required: options.required,
            help: options.description,
            dest: name,
        });
    }
    
    function configureParam(options, name) {
        var switches = [name];
        
        if (options.alias) switches.push(options.alias);
        
        parser.addArgument(switches, {
            nargs: '?',
            defaultValue: options.defaultValue,
            type: options.type,
            required: options.required,
            help: options.description,
        });
    }
};
