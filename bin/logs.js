var Bluebird = require('bluebird');
var Boom = require('boom');
var Bunyan = require('bunyan');
var Cli = require('nested-yargs');
var Colors = require('colors');
var PrettyStream = require('bunyan-prettystream');
var Webtask = require('../');
var _ = require('lodash');


module.exports = Cli.createCommand('logs', 'Streaming, real-time logs.', {
    params: '[container]',
    options: {
        raw: {
            alias: 'r',
            description: 'do not pretty print',
            type: 'boolean',
        },
        profile: {
            alias: 'p',
            description: 'name of the profile to set up',
            'default': 'default',
            type: 'string',
        },
    },
    handler: handleStream,
});

  
function handleStream (argv) {
    var prettyStdOut = new PrettyStream({ mode: 'short' });
    var logger = Bunyan.createLogger({
          name: 'wt',
          streams: [{
              level: 'debug',
              type: 'raw',
              stream: prettyStdOut
          }]
    });    

    prettyStdOut.pipe(process.stdout);
    
    var container = argv.params.container;
    
    if (container) {
        argv.container = container;
    }
    
    var config = Webtask.configFile();
    
    config.load()
        .then(function (profiles) {
            if (_.isEmpty(profiles)) {
                throw new Error('You must create a profile to begin using '
                    + 'this tool: `wt init`.');
            }
            
            return config.getProfile(argv.profile);
        })
        .then(function (profile) {
            return Bluebird.all([
                profile,
                profile.createLogStream(argv)
            ]);
        })
        .spread(function (profile, stream) {
            logger.info({ container: profile.container },
                'connected to streaming logs');

            setTimeout(function () {
                logger.warn('reached maximum connection time of 30min, '
                    +'disconnecting');
                process.exit(1);
            }, 30 * 60 * 1000).unref();
            
            stream.on('data', function (event) {
                if (event.type === 'data') {
                    try {
                        var data = JSON.parse(event.data);
                    } catch (__) { return; }
                    
                    if (argv.raw) console.log(data);
                    else if (typeof data === 'string') prettyStdOut.write(data);
                    else prettyStdOut.write(data);
                }
            });
        })
        .catch(logError);
}

function logError (e) {
    console.error(e);
    console.log(e.message.red);
    if (e.trace) console.log(e.trace);
    process.exit(1);
}
