var Bunyan = require('bunyan');
var Chalk = require('chalk');
var Cli = require('../cli');
var ConfigFile = require('../lib/config');
var Errors = require('../lib/errors');
var PrettyStream = require('bunyan-prettystream');
var _ = require('lodash');


module.exports = Cli.command('logs', {
    description: 'Streaming, real-time logs',
    handler: handleLogs,
    options: {
        raw: {
            alias: 'r',
            description: 'Do not pretty print',
            type: 'boolean',
        },
        all: {
            alias: 'a',
            description: 'Show cluster logs',
            type: 'boolean',
        },
        verbose: {
            alias: 'v',
            description: 'Show verbose logs',
            type: 'boolean',
        },
        profile: {
            alias: 'p',
            description: 'Name of the webtask profile to use',
            defaultValue: 'default',
            type: 'string',
        },
    },
    params: {
        'container': {
            description: 'Container from which to stream logs',
            type: 'string',
        },
    },
});


// Command handler

function handleLogs(args) {
    var config = new ConfigFile();

    return config.load()
        .then(loadProfile)
        .then(function (profile) {
            var logStream = profile.createLogStream({ json: true });
            var logger = args.raw
                ?   console
                :   createBunyanLogger();
            
            logStream.once('open', function () {
                logger.info({ container: args.container || profile.container },
                    'connected to streaming logs');
            });
            
            logStream.once('error', function (err) {
                logger.error(err.message);
            });

            setTimeout(function () {
                logger.warn('reached maximum connection time of 30min, '
                    +'disconnecting');
                
                process.exit(1);
            }, 30 * 60 * 1000).unref();
            
            logStream.on('data', function (data) {
                args.verbose
                    ?   logger.info(data, data.msg)
                    :   logger.info(data.msg);
            });
        })
        .catch(_.matchesProperty('code', 'E_NOTFOUND'), function (err) {
            console.error(Chalk.red(err.message));
            
            process.exit(1);            
        });
    
    
    function loadProfile(profiles) {
        if (_.isEmpty(profiles)) {
            throw Errors.notFound('No webtask profiles configured');
        }
        
        return config.getProfile(args.profile);
    }
    
    function createBunyanLogger() {
        var prettyStdOut = new PrettyStream();
        var logger = Bunyan.createLogger({
              name: 'wt',
              streams: [{
                  level: 'debug',
                  type: 'raw',
                  stream: prettyStdOut
              }]
        });    
    
        prettyStdOut.pipe(process.stdout);
        
        return logger;
    }
}

