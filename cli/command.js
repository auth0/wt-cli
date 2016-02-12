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
            action: options.action || (options.type !== 'boolean' ? 'store' : 'storeTrue'),
            choices: options.choices,
            defaultValue: options.defaultValue,
            // type: options.type === 'boolean' ? 'bool' : options.type,
            metavar: options.metavar,
            required: options.required,
            help: options.description,
            dest: options.dest || name,
        });
    }
    
    function configureParam(options, name) {
        var switches = [name];
        
        if (options.alias) switches.push(options.alias);
        
        parser.addArgument(switches, {
            nargs: options.nargs || (options.required ? undefined : '?'),
            defaultValue: options.defaultValue,
            type: options.type,
            help: options.description,
        });
    }
};
