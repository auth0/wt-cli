'use strict';


const Bluebird = require('bluebird');
const Chalk = require('chalk');
const Cli = require('structured-cli');
const Path = require('path');
const Runtime = require('webtask-runtime');


module.exports = Cli.createCommand('serve', {
    description: 'Run a webtask as a local http server',
    options: {
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
    return Bluebird.using(createServer(), server => {
        return server.listenAsync(args.port, args.hostname)
            .tap(() => {
                const address = server.address();
                
                console.log('Your webtask is now listening for %s traffic on %s:%s', address.family, address.address, address.port);
            })
            .delay(1000 * 60 * 30)
            .then(server => {
                console.log('Automatically shutting down your webtask server after 30m');
            });
    })
        .timeout(1000 * 60 * 30);
    

    function createServer() {
        const promise$ = new Bluebird((resolve, reject) => {
            try {
                const webtask = require(Path.resolve(process.cwd(), args.filename)); 
                const server = Runtime.createServer(webtask, {
                    shortcutFavicon: true,
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

