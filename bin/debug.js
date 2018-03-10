'use strict';

const Bluebird = require('bluebird');
const Cli = require('structured-cli');
const spawn = require('child_process').spawn;
const _ = require('lodash');
const config = require('./serveCommon')();

config.description = "Debug a webtask";
config.handler = handleDebug;
config.optionGroups.ExecutionOptions =
    {
        'debugger': {
            alias: 'd',
            description: 'Debugger to use. "devtool" requires installing the devtool cli (npm install devtool -g)',
            choices: ['devtool', 'node'],
            dest: 'debugger',
            defaultValue: 'node'
        },
        'debugger-port': {
            description: 'When using "node", the port to expose',
            dest: 'debuggerPort',
            type: 'int',
        },
    };

module.exports = Cli.createCommand('debug', config);

function handleDebug(args) {
    const newArgs = [process.argv[1], 'serve'];

    let skipArg = false;
    _.each(process.argv.slice(3), (value)=> {
        if (skipArg === true) {
            skipArg = false;
            return;
        }

        const arg = value.toLowerCase();

        if (arg.startsWith('--debugger')) {
            skipArg = !arg.includes('=');
            return;
        }

        if (arg.startsWith('-d')) {
            skipArg = arg === '-d';
            return;
        }

        newArgs.push(value);
    });

    if (args.debugger === 'node') {
        return new Bluebird(debugNode(newArgs, args.debuggerPort));
    }
    else if (args.debugger === 'devtool') {
        return new Bluebird(debugDevtool(newArgs));
    }
}

function debugNode(newArgs, debuggerPort) {
    const validPort = debuggerPort && (1024 < debuggerPort || (debuggerPort <= 1024 && process.getuid && process.getuid() === 0));
    const version = parseInt(process.version.replace('v', ''));

    if(version < 8) {
        if (validPort)
            newArgs = ['--debug-port=' + debuggerPort].concat(newArgs);
        newArgs = ['--debug'].concat(newArgs);
    } else {
        if (validPort)
            newArgs = ['--inspect-port=' + debuggerPort].concat(newArgs);
        newArgs = ['--inspect'].concat(newArgs); 
    }

    return function(resolve, reject) {
        spawnProcess(process.execPath, newArgs, resolve);
    }
}

function debugDevtool(newArgs) {
    return function(resolve, reject) {
        spawnProcess('devtool', newArgs, resolve);
    }
}

function spawnProcess(launcher, args, resolve) {
    var node = spawn(launcher, args);
    
    node.stdout.on('data', (data) => {
        console.log(`${data}`);
    });

    node.stderr.on('data', (data) => {
        console.error(`${data}`);
    });

    node.on('close', (code) => {
        resolve();
    });
}
