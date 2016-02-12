var App = require('./app');
var ArgumentParser = require('argparse').ArgumentParser;
var Bluebird = require('bluebird');
var Category = require('./category');
var Chalk = require('chalk');
var Command = require('./command');
var Node = require('./node');
var _ = require('lodash');




exports.app = createApp;
exports.category = createCategory;
exports.command = createCommand;
exports.run = runCli;

exports.error = {
    cancelled: cancelled,
    hint: hint,
    invalid: invalid,
    notFound: notFound,
    timeout: timeout,
};




// Exported interface

function createApp(options) {
    return new App(options);
}

function createCategory(name, options) {
    return new Category(name, options);
}

function createCommand(name, options) {
    return new Command(name, options);
}


function runCli(node, options) {
    if (!(node instanceof Node)) {
        throw new Error('A CLI `Node` must be passed to run');
    }
    
    if (!options) options = {};
    
    var parser = new ArgumentParser(_.defaults(this.options, {
        addHelp: true,
    }));
    
    node.configure(parser);
    
    var args = parser.parseArgs();
    
    if (!(typeof args.handler === 'function')) {
        parser.printHelp();
        process.exit(1);
    }
    
    var promise$ = Bluebird.try(function () {
        return args.handler(args);
    })
        .timeout(options.timeout || 30 * 60 * 1000, 'reached maximum execution time disconnecting');
    
    promise$
        .catch(Bluebird.TimeoutError, function (err) {
            console.error(Chalk.red(err.message));
            
            process.exit(1);
        })
        .catch(_.matchesProperty('code', 'E_INVALID'), function (err) {
            parser.error(Chalk.red(err.message));
            
            // argparse triggers `process.exit(2)`
        })
        .catch(_.matchesProperty('code', 'E_HINT'), function (err) {
            console.error(err.message);
            
            process.exit(3);
        })
        .catch(function (err) {
            console.error(Chalk.red('Uncaught error: ', err.message));
            console.error(err.stack);
            console.error('Please report this at: https://github.com/auth0/wt-cli/issues');
            
            process.exit(4);
        })
        .then(function () {
            process.exit(0);
        });
}

function cancelled(message, data) {
    return createError(message, 'E_CANCELLED', data, cancelled);
}

function hint(message, data) {
    return createError(message, 'E_HINT', data, hint);
}

function invalid(message, data) {
    return createError(message, 'E_INVALID', data, invalid);
}

function notFound(message, data) {
    return createError(message, 'E_NOTFOUND', data, notFound);
}

function timeout(message, data) {
    return createError(message, 'E_TIMEDOUT', data, timeout);
}


// Private helper functions

function createError(message, code, data, ctor) {
    var error = new Error(message ? message : undefined);
    
    Error.captureStackTrace(error, ctor);
    
    error.code = code;
    error.data = data;
    error.isCli = true;
    
    return error;
}