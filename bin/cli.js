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
    return this.setup(yargs || Yargs())
        .version(require('../package.json').version)
        .parse(process.argv)
        .argv;
};

Category.prototype.setup = function (yargs) {
    var self = this;
    
    _.forEach(this.commands, function (command, name) {
        yargs.command(name, command.description, command.setup.bind(command));
    });
    
    yargs
        .help('help')
        .check(function (argv) {
            var commandName = argv._[self.path.length + 1];
            var command = self.commands[commandName];
            
            if (!commandName) throw new Error('Please enter a valid command.');
            if (!command) throw new Error('No such command `' + commandName + '`');

            return true;
        })
        .fail(function (err) {
            yargs.showHelp();
            
            console.log((err.message || err).red);
        })
        // .fail(this.errorHandler)
        .usage('Usage: ' + this.path.join(' ') + ' <command>');
    
    return yargs;
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

Command.prototype.setup = function (yargs) {
    var self = this;
    
    console.log('yargs', yargs);
    
    yargs
        .help('help')
        .check(function (argv) {
            return true;
        })
        .fail(function (err) {
            yargs.showHelp();
            
            console.log((err.message || err).red);
        })
        // .fail(this.errorHandler)
        .usage('Usage: ' + this.path.join(' ')
            + ' [options]'
            + (this.params ? ' ' + this.params : ''));
    
    return yargs;
};



exports.createCategory = function (name, description, options) {
    return new Category(name, description, options);
};

exports.createCommand = function (name, description, options) {
    return new Command(name, description, options);
};