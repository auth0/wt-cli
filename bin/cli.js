var Bluebird = require('bluebird');
var Colors = require('colors');
var Yargs = require('yargs');
var _ = require('lodash');

function Category (name, description, options) {
    this.commands = {};
    this.name = name || '$0';
    this.description = description || '';
    this.options = options || {};
    this.parent = null;
    
    Object.defineProperty(this, 'path', {
        enumerable: true,
        get: function () {
            return this.parent
                ? this.parent.path.concat([this.name])
                : [this.name];
        }
    });
}

Category.prototype.command = function (command) {
    this.commands[command.name] = command;
    
    command.parent = this;
    
    return this;
};

Category.prototype.run = function (yargs) {
    var self = this;
    var errorHandler = createErrorHandler(yargs);
    
    _.forEach(this.commands, function (command) {
        yargs.command(command.name, command.description, command.run.bind(command));
    });
        
    if (this.options.setup) this.options.setup(yargs);
    if (this.options.options) yargs.options(this.options.options);
    
    yargs
        .usage('Usage: ' + this.path.join(' ') + ' <command>')
        .check(function (argv) {
            var commandName = argv._[self.path.length - 1];
            var command = self.commands[commandName];
            
            if (!commandName) throw new Error('Please enter a valid command.');
            if (!command) throw new Error('No such command `' 
                + self.path.slice(1).join(' ')+ ' '
                + commandName + '`');

            return true;
        })
        .demand(self.path.length, 'Please enter a valid command.')
        .fail(errorHandler);
    
    yargs.help('help');
        
    var argv = yargs.argv;
    
    return argv;
};


function Command (name, description, options) {
    this.name = name || '$0';
    this.description = description || '';
    this.parent = null;
    this.options = _.defaultsDeep(options || {}, {
        params: '',
    });
    
    Object.defineProperty(this, 'path', {
        enumerable: true,
        get: function () {
            return this.parent
                ? this.parent.path.concat([this.name])
                : [this.name];
        }
    });
}

Command.prototype.run = function (yargs) {
    var self = this;
    var errorHandler = createErrorHandler(yargs);
    
    if (this.options.setup) this.options.setup(yargs);
    if (this.options.options) yargs.options(this.options.options);
    
    yargs
        .check(function (argv) {
            if (self.options.params) {
                var required = 0;
                var optional = 0;
                
                argv.params = {};
                
                self.options.params.replace(/(<[^>]+>|\[[^\]]+\])/g,
                    function (match) {
                        var isRequired = match[0] === '<';
                        var param = match.slice(1, -1);
                        
                        if (isRequired && optional > 0)
                            throw new Error('Optional parameters must be specified last');
                        
                        if (isRequired) required++;
                        else optional++;
                        
                        var value = argv._[self.path.length - 2 + required + optional];
                        
                        if (isRequired && !value) throw new Error('Parameter '
                            + '`' + param + '` is required.');
                        
                        argv.params[param] = value;
                    });
            }
            
            return true;
        })
        .fail(errorHandler)
        .usage('Usage: ' + this.path.join(' ')
            + ' [options]'
            + (this.options.params ? ' ' + this.options.params : ''));
    
    yargs.help('help');
        
    var argv = yargs.argv;
    
    if (this.options.handler)
        Bluebird.try(this.options.handler.bind(this, argv))
            .catch(errorHandler);
    
    return argv;
};


function createErrorHandler (yargs) {
    return function (err) {
        yargs.showHelp();
        
        console.log((err.message || err).red);
        process.exit(1);
    };
}



exports.createCategory = function (name, description, options) {
    return new Category(name, description, options);
};

exports.createCommand = function (name, description, options) {
    return new Command(name, description, options);
};


exports.run = function (command, yargs) {
    var argv = command.run(yargs || Yargs);
    
    return argv;
};