var Bluebird = require('bluebird');
var Cli = require('structured-cli');
var Logs = require('../lib/logs');
var _ = require('lodash');


module.exports = Cli.createCommand('logs', {
    description: 'Streaming, real-time logs',
    plugins: [
        require('./_plugins/profile'),
    ],
    optionGroups: {
        'Log options': {
            raw: {
                alias: 'r',
                description: 'Do not pretty print',
                type: 'boolean',
            },
            verbose: {
                alias: 'v',
                description: 'Show verbose logs',
                type: 'boolean',
            },
        },
        browser: {
            alias: 'b',
            description: 'create URL to see logs in a browser',
            type: 'boolean',
        },
    },
    handler: handleLogs,
});


// Command handler

function handleLogs(args) {
    var profile = args.profile;

    return new Bluebird((resolve, reject) => {
        const logs = profile.createLogStream({ json: true });
        const logger = Logs.createLogStream(logs, Object.assign({
            container: profile.container,
        }, args));
        const timeout = setTimeout(() => {
            const error = Cli.error.timeout('Automatically disconnecting from logs after 30min');

            return reject(error);
        }, 30 * 60 * 1000);

        logs.once('close', () => {
            clearTimeout(timeout);

            const error = Cli.error.cancelled('Connection to streaming log endpoint lost');

            return reject(error);
        });

        logs.once('error', (error) => {
            logger.error(error.message);

            clearTimeout(timeout);

            return reject(Cli.error.serverError(`Error connecting to streaming log endpoint: ${ error.message }`));
        });

        process.once('SIGINT', () => {
            logger.warn('Received SIGINT; disconnecting from logs');
            return resolve();
        });
    });
}

