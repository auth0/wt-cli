'use strict';

const Bluebird = require('bluebird');
const Chalk = require('chalk');
const Cli = require('structured-cli');
const Path = require('path');
const Runtime = require('webtask-runtime');
const _ = require('lodash');
const config = require('./serveCommon')();

config.description = "Run a webtask as a local http server";
config.handler = handleWebtaskServe;

module.exports = Cli.createCommand('serve', config);

// Command handler

function handleWebtaskServe(args) {
    parseKeyValList(args, 'secrets');
    parseKeyValList(args, 'params');
    
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
    }).timeout(1000 * 60 * 30);
    
    function createServer() {
        const promise$ = new Bluebird((resolve, reject) => {
            try {
                const webtask = require(Path.resolve(process.cwd(), args.filename)); 
                const server = Runtime.createServer(webtask, {
                    parseBody: args.parseBody ? Runtime.PARSE_ALWAYS : undefined,
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

