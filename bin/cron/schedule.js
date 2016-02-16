var Cli = require('structured-cli');
var ConfigFile = require('../../lib/config');
var Logs = require('../../lib/logs');
var PrintCronJob = require('../../lib/printCronJob');
var ValidateCreateArgs = require('../../lib/validateCreateArgs');
var WebtaskCreator = require('../../lib/webtaskCreator');
var _ = require('lodash');


var createCommand = require('../create');


module.exports = Cli.createCommand('schedule', {
    description: 'Schedule a webtask to run periodically',
    handler: handleCronSchedule,
    options: _.extend({}, createCommand.options.options, {
        
    }),
    params: _.extend({}, {
        'schedule': {
            description: 'The cron-formatted schedule (see: http://crontab.guru/)',
            type: 'string',
            required: true,
        },
    }, createCommand.options.params),
});


// Command handler

function handleCronSchedule(args) {
    args = ValidateCreateArgs(args);
    
    var config = new ConfigFile();

    return config.getProfile(args.profile)
        .then(onProfile);
        
    
    function onProfile(profile) {
        var createWebtask = WebtaskCreator(args, {
            onGeneration: onGeneration,
        });
        var logger = createLogger(args, profile);

        return createWebtask(profile);
        
        
        function onGeneration(build) {
            if (args.watch) {
                logger.log({ generation: build.generation, container: build.webtask.container }, 'Webtask created: %s. Scheduling cron job...', build.webtask.url);
            }
            
            return build.webtask.createCronJob({ schedule: args.schedule })
                .then(onCronScheduled, onCronError);
                
            
            function onCronScheduled(job) {
                args.watch
                    ?   logger.log({
                            generation: build.generation,
                            container: job.container,
                            state: job.state,
                            schedule: job.schedule,
                            next_available_at: new Date(job.next_available_at).toLocaleString(),
                            created_at: new Date(job.created_at).toLocaleString(),
                            run_count: job.run_count,
                            error_count: job.error_count,
                        }, 'Cron job scheduled')
                    :   PrintCronJob(job, logger);
            }
            
            function onCronError(err) {
                switch (err.statusCode) {
                    case 400: throw Cli.error.invalid('Invalid cron job; please check that the schedule is a valid cron schedule');
                    default: throw err;
                }
            }
        }
    }
}

function createLogger(args, profile) {
    if (args.watch) {
        var logs = Logs.createLogStream(profile);
        
        return {
            log: _.bindKey(logs, 'info'),
            error: _.bindKey(logs, 'error'),
        };
    } else {
        return {
            log: _.bindKey(console, 'log'),
            error: _.bindKey(console, 'error'),
        };
    }
}
