var program = require('commander')
    , logger = program.wt.logger
    , https = require('https')
    , url = require('url');

program
    .command('logs [container]')
    .description('streaming, real-time logs')
    .option('-r --raw', 'do not pretty print')
    .option('-p --profile <name>', 'config profile to use', 'default')
    .action(logs_action);

function logs_action(container, options) {
    var profile = program.wt.ensure_profile(options.profile);    
    container = container || profile.container;
    var data = '';
    var opts = url.parse(profile.url + '/api/logs/tenant/' + container);
    opts.headers = {
        'Authorization': 'Bearer ' + profile.token,
        'Accept': 'text/event-stream'        
    };

    setTimeout(function () {
        logger.warn('reached maximum connection time of 30min, disconnecting');
        process.exit(1);
    }, 1800 * 1000).unref();

    https.get(opts, function (res) {
        res.setEncoding('utf8');
        if (res.statusCode == 200 && !options.raw) {
            logger.info({ container: container }, 'connected to streaming logs');
        }        
        res.on('data', function (chunk) {
            data += chunk;
            if (res.statusCode === 200) {
                var i;
                do {
                    i = data.indexOf('\n\n');
                    if (i > -1) {
                        var record = data.substring(0, i);
                        data = data.substring(i + 2);
                        if (record.indexOf('event:ping') === -1) {
                            var match = record.match(/\ndata\:(.+)/);
                            if (match) {
                                if (options.raw) {
                                    console.log(match[1]);
                                }
                                else {
                                    var json = match[1];
                                    try {
                                        json = JSON.parse(json);
                                    }
                                    catch (e) {
                                        // empty
                                    };
                                    if (typeof json === 'string') {
                                        console.log(match[1]);
                                    }
                                    else {
                                        logger.prettyStdOut.write(json);
                                    }
                                }
                            }
                        }
                    }
                } while (i > -1);
            }
        });
        res.on('end', function () {
            if (res.statusCode !== 200) {
                try {
                    data = JSON.parse(data);
                }
                catch (e) {};
                if (res.statusCode === 403 && !data) {
                    data = 'No permission to access logs of container `' + container + '`.';
                }
                logger.error({ container: container, status: res.statusCode, details: data }, 'error connecting');
                process.exit(1);
            }
        });
    }).on('error', function (err) {
        logger.error(err, 'error connecting');
        process.exit(1);
    });
}
