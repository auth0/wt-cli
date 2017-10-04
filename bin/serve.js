'use strict';

const Bluebird = require('bluebird');
const Chalk = require('chalk');
const Cli = require('structured-cli');
const Dotenv = require('dotenv');
const Fs = require('fs');
const keyValList2Object = require('../lib/keyValList2Object');
const Path = require('path');
const Runtime = require('webtask-runtime');
const _ = require('lodash');
const config = require('./serveCommon')();

config.description = "Run a webtask as a local http server";
config.handler = handleWebtaskServe;

module.exports = Cli.createCommand('serve', config);

// Command handler

function handleWebtaskServe(args) {
    keyValList2Object(args, 'secrets');
    keyValList2Object(args, 'params');
    keyValList2Object(args, 'meta');

    if (args.secretsFile) {
        try {
            const filename = Path.resolve(process.cwd(), args.secretsFile);
            const content = Fs.readFileSync(filename, 'utf8');
            const secrets = Dotenv.parse(content);

            for (let secret in secrets) {
                if (!args.secrets.hasOwnProperty(secret)) {
                    args.secrets[secret] = secrets[secret];
                }
            }
        } catch (e) {
            throw Cli.error.invalid(`Error loading secrets file: ${e.message}`);
        }
    }

    if (args.metaFile) {
        try {
            const filename = Path.resolve(process.cwd(), args.metaFile);
            const content = Fs.readFileSync(filename, 'utf8');
            const meta = Dotenv.parse(content);

            for (let key in meta) {
                if (!args.meta.hasOwnProperty(key)) {
                    args.meta[key] = meta[key];
                }
            }
        } catch (e) {
            throw Cli.error.invalid(`Error loading meta file: ${e.message}`);
        }
    }
    return Bluebird.using(createServer(), server => {
        return server.listenAsync(args.port, args.hostname)
            .tap(() => {
                const address = server.address();
                
                console.log('Your webtask is now listening for %s traffic on %s:%s', Chalk.green(address.family), Chalk.green.bold(address.address), Chalk.green.bold(address.port));
            })
            .delay(1000 * 60 * 30)
            .then(() => {
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
                    meta: args.meta,
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
}

