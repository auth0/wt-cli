var Bunyan = require('bunyan');
var PrettyStream = require('bunyan-prettystream');


exports.createLogStream = createLogStream;


function createLogStream(profile, options) {
    if (!options) options = {};
    
    var logStream = profile.createLogStream({ json: true });
    var logger = options.raw
        ?   console
        :   createBunyanLogger();
    
    logStream.once('open', function () {
        logger.info({ container: options.container || profile.container },
            'connected to streaming logs');
    });
    
    logStream.once('close', function () {
        logger.error('Connection closed');
    });
    
    logStream.once('error', function (err) {
        console.dir(err.stack);
        logger.error(err.message);
    });

    // setTimeout(function () {
    //     logger.warn('reached maximum connection time of 30min, '
    //         +'disconnecting');
        
    //     process.exit(1);
    // }, 30 * 60 * 1000).unref();
    
    logStream.on('data', function (data) {
        options.verbose
            ?   logger.info(data, data.msg)
            :   logger.info(data.msg);
    });
    
    return logger;
}


function createBunyanLogger() {
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
    
    return logger;
}
