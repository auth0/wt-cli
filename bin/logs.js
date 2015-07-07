var Bluebird = require('bluebird');
var Boom = require('boom');
var Colors = require('colors');
var PrettyStream = require('bunyan-prettystream');
var Webtask = require('../');
var _ = require('lodash');


module.exports = handleStream;

  
function handleStream (yargs) {
    var log = new PrettyStream({ mode: 'short' });
    
    log.pipe(process.stdout);

    var argv = yargs.usage('Usage: $0 logs [options] [container]')
        .options({
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
        })
        .help('help')
        .argv;
    
    var container = argv._[2];
    
    if (container) {
        argv.container = container;
    }
    
    var config = Webtask.configFile();
    
    config.load()
        .then(function (profiles) {
            if (_.isEmpty(profiles)) {
                throw new Error('You must create a profile to begin using '
                    + 'this tool: `wt profile init`.');
            }
            
            return config.getProfile(argv.profile);
        })
        .call('createLogStream', argv)
        .then(function (stream) {
            stream.on('data', function (event) {
                if (event.type === 'data') {
                    try {
                        var data = JSON.parse(event.data);
                    } catch (__) { return; }
                    
                    if (typeof data === 'string') console.log(data);
                    else log.write(data);
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
