'use strict';

const Bluebird = require('bluebird');
const Cli = require('structured-cli');
const spawn = require('child_process').spawn;
const _ = require('lodash');
const config = require('./serveCommon')();
var newArgs = null;

config.description = "Debug a webtask";
config.handler = handleDebug;
config.optionGroups.ExecutionOptions =
    {
        'debugger': {
            alias: 'd',
            description: 'Debugger to use. "devtool" requires installing the devtool cli (npm install devtool -g)',
            choices: ['devtool', 'node', 'inspect'],
            dest: 'debugger',
            defaultValue: 'node'
        }
    };

module.exports = Cli.createCommand('debug', config);

function handleDebug(args) {
    newArgs = [process.argv[1], 'serve']
    _.each(process.argv.slice(3), (value)=> {
        var arg = value.toLowerCase();
        if (!(arg === 'debug' || (arg.startsWith('--debugger=') || arg.startsWith('-d')))) {
            newArgs.push(arg);
        }
    });
    if (args.debugger === 'node') {
        return new Bluebird(debugNode);
    }
    else if (args.debugger === 'devtool') {
        return new Bluebird(debugDevtool);
    }
    else if(args.debugger === 'inspect'){
        return new Bluebird(debugNodeInspectMode);
    }
}

function debugNodeInspectMode(resolve, reject) {
    newArgs = ['--inspect'].concat(newArgs);
    spawnProcess(process.execPath, newArgs, resolve);
}

function debugNode(resolve, reject) {
    newArgs = ['--debug'].concat(newArgs); 
    spawnProcess(process.execPath, newArgs, resolve);
}

function debugDevtool(resolve, reject) {
    spawnProcess('devtool', newArgs, resolve);
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
