'use strict';


const Bluebird = require('bluebird');
const Chalk = require('chalk');
const Cli = require('structured-cli');
const Path = require('path');
const Runtime = require('webtask-runtime');
const spawn = require('child_process').spawn;
const _ = require('lodash');
var i = null;

module.exports = Cli.createCommand('serve', {
    description: 'Run a webtask as a local http server',
    optionGroups: {
        'Server options': {
            port: {
                alias: 'p',
                description: 'Port on which the webtask server will listen',
                type: 'int',
                defaultValue: 8080,
            },
            'hostname': {
                description: 'The hostname for the http listener',
                type: 'string',
                defaultValue: '0.0.0.0',
            },
        },
        'Execution options': {
            'debugtask': {
                alias: 'd',
                description: 'Debug your task locally. "devtool" requires installing the devtool cli (npm install devtool -g)',
                choices: ['devtool', 'node'],
                dest: 'debugtask'
            }
        },
        'Webtask creation': {
            'secret': {
                action: 'append',
                alias: 's',
                defaultValue: [],
                description: 'Secret(s) exposed to your code as `secrets` on the webtask context object. These secrets will be encrypted and stored in a webtask token in such a way that only the webtask server is able to decrypt the secrets so that they may be exposed to your running webtask code.',
                dest: 'secrets',
                metavar: 'KEY=VALUE',
                type: 'string',
            },
            'param': {
                action: 'append',
                defaultValue: [],
                description: 'Param(s) exposed to your code as `params` on the webtask context object. The properties will be signed and protected from interference but not encrypted.',
                dest: 'params',
                metavar: 'KEY=VALUE',
                type: 'string',
            },
            'no-merge': {
                action: 'storeFalse',
                defaultValue: true,
                description: 'Disable automatic merging of the parsed body and secrets into the `data` field of the webtask context object. The parsed body (if available) will be on the `body` field and secrets on the `secrets` field.',
                dest: 'mergeBody',
            },
            'no-parse': {
                action: 'storeFalse',
                defaultValue: true,
                description: 'Disable automatic parsing of the incoming request body. Important: when using webtask-tools with Express and the body-parser middleware, automatic body parsing must be disabled.',
                dest: 'parseBody',
            },
            'storage-file': {
                description: 'Provide a file that will be used to initialize and persist webtask storage data',
                dest: 'storageFile',
            },
        },
    },
    params: {
        'filename': {
            description: 'The path to the webtask\'s source code',
            type: 'string',
            required: true,
        },
    },
    handler: handleWebtaskServe,
});


// Command handler

function handleWebtaskServe(args) {
    parseKeyValList(args, 'secrets');
    parseKeyValList(args, 'params');

    if (args.debugtask != undefined) {
        return handleDebug();
    } 
    
    return Bluebird.using(createServer(), server => {
        return server.listenAsync(args.port, args.hostname)
            .tap(() => {
                const address = server.address();
                
                console.log('Your webtask is now listening for %s traffic on %s:%s', Chalk.green(address.family), Chalk.green.bold(address.address), Chalk.green.bold(address.port));
            })
            .delay(1000 * 60 * 30)
            .then(server => {
                console.log('Automatically shutting down your webtask server after 30m');
            });
    })
        .timeout(1000 * 60 * 30);
    
    
    function handleDebug() {
        process = require('process');
        
        i = process.argv.findIndex((item) => {return item.startsWith("--debugtask")});
        i = i > -1 ? i : process.argv.findIndex((i) => {return i.startsWith("-d=")});

        if (args.debugtask == "node") {
            return new Bluebird(debugNode);
        }
        else if (args.debugtask == "devtool") {
            return new Bluebird(debugDevtool);
        }
    }
    
    function debugNode(resolve, reject) {
        var newArgs = ['--debug'].concat(process.argv.slice(1, i)); 

        if (process.argv.length >= i-1) 
        {
            var newArgs = newArgs.concat(process.argv.slice(i+1, process.argv.length));
        }
        spawnProcess(process.execPath, newArgs, resolve);
    }

    function debugDevtool(resolve, reject) {
        var newArgs = process.argv.slice(1, i); 

        if (process.argv.length >= i-1) 
        {
            var newArgs = newArgs.concat(process.argv.slice(i+1, process.argv.length));
        }
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

    function createServer() {
        const promise$ = new Bluebird((resolve, reject) => {
            try {
                const webtask = require(Path.resolve(process.cwd(), args.filename)); 
                const server = Runtime.createServer(webtask, {
                    parseBody: args.parseBody,
                    mergeBody: args.mergeBody,
                    secrets: args.secrets,
                    params: args.params,
                    shortcutFavicon: true,
                    storageFile: args.storageFile,
                });
                
                return resolve(Bluebird.promisifyAll(server));
            } catch (e) {
                return reject(new Error(`Error starting local server: ${e.message}`));
            }
        });
        
        return promise$
            .disposer(server => {
                server.listening
                    ?   server.closeAsync()
                            .tap(() => console.log('Webtask server shut down'))
                    :   Bluebird.resolve();
            });
    }


    function parseKeyValList(args, field) {
        args[field] = _.reduce(args[field], function (acc, entry) {
            var parts = entry.split('=');

            return _.set(acc, parts.shift(), parts.join('='));
        }, {});
    }
    
}

