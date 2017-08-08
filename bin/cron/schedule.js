var Cli = require('structured-cli');
var Logs = require('../../lib/logs');
var PrintCronJob = require('../../lib/printCronJob');
var ValidateCreateArgs = require('../../lib/validateCreateArgs');
var WebtaskCreator = require('../../lib/webtaskCreator');
var _ = require('lodash');


var intervals = {
    minutes: {
        abbrev: ['m', 'min', 'mins', 'minute', 'minutes'],
        values: [ 1, 2, 3, 4, 5, 6, 10, 15, 20, 30, 60 ],
        encode: function (frequencyValue) {
            var now = new Date();
            var cron = ['*', '*', '*', '*', '*'];
            var curr = now.getMinutes();
            var mod = curr % frequencyValue;

            cron[0] = frequencyValue === 60
                ?   curr
                :   mod > 0
                    ?  (curr % frequencyValue) + '-' + (59) + '/' + (frequencyValue)
                    :   '*/' + (frequencyValue);

            return cron.join(' ');
        },
    },
    hours: {
        abbrev: ['h', 'hour', 'hours' ],
        values: [ 1, 2, 3, 4, 6, 8, 12, 24],
        encode: function (frequencyValue) {
            var now = new Date();
            var cron = [now.getMinutes(), '*', '*', '*', '*'];
            var curr = now.getHours();
            var mod = curr % frequencyValue;

            cron[1] = frequencyValue === 24
                ?   curr
                :   mod > 0
                    ?  (curr % frequencyValue) + '-' + (23) + '/' + (frequencyValue)
                    :   '*/' + (frequencyValue);

            return cron.join(' ');
        },
    },
    days: {
        abbrev: ['d', 'day', 'days'],
        values: [ 1 ],
        encode: function () { return intervals.hours.encode(24); },
    },
};


var createCommand = require('../create');


module.exports = Cli.createCommand('schedule', {
    description: 'Schedule a webtask to run periodically',
    plugins: [
        require('../_plugins/profile'),
    ],
    optionGroups: _.extend({}, createCommand.optionGroups, {
        'Cron options': {
            'state': {
                description: 'Set the cron job\'s state',
                choices: ['active', 'inactive'],
                defaultValue: 'active',
                type: 'string',
            },
        },
    }),
    options: _.extend({}, createCommand.options, {

    }),
    params: _.extend({}, {
        'schedule': {
            description: 'Either a cron-formatted schedule (see: http://crontab.guru/) or an interval of hours ("h") or minutes ("m"). Note that not all intervals are possible.',
            type: 'string',
            required: true,
        },
    }, createCommand.params),
    epilog: [
        'Examples:',
        '1. Create a webtask that runs every five minutes:',
        '  $ wt cron schedule 5m ./sample-webtasks/hello-world.js',
        '2. Create a webtask that runs every Tuesday at 09:05:',
        '  $ wt cron schedule "5 9 * * 2" ./sample-webtasks/hello-world.js',
    ].join('\n'),
    handler: handleCronSchedule,
});


// Command handler

function handleCronSchedule(args) {
    var profile = args.profile;

    args = ValidateCreateArgs(args);

    var schedule = args.schedule;

    if (schedule.split(' ').length !== 5) {
        var minutesRx = new RegExp('^\s*([0-9]{1,2})\s*(' + intervals.minutes.abbrev.join('|') + ')\s*$', 'i');
        var hoursRx = new RegExp('^\s*([0-9]{1,2})\s*(' + intervals.hours.abbrev.join('|') + ')\s*$', 'i');
        var daysRx = new RegExp('^\s*([0-9]{1,2})\s*(' + intervals.days.abbrev.join('|') + ')\s*$', 'i');
        var frequencyValue;
        var type;
        var matches;

        if ((matches = schedule.match(minutesRx))) {
            type = intervals.minutes;
            frequencyValue = parseInt(matches[1], 10);
        } else if ((matches = schedule.match(hoursRx))) {
            type = intervals.hours;
            frequencyValue = parseInt(matches[1], 10);
        } else if ((matches = schedule.match(daysRx))) {
            type = intervals.days;
            frequencyValue = parseInt(matches[1], 10);
        } else {
            throw new Cli.error.invalid('The schedule `' + schedule + '` is not valid.');
        }

        if (type.values.indexOf(frequencyValue) === -1) {
            throw new Cli.error.invalid('For intervals in ' + type.abbrev[type.abbrev.length - 1] + ', the following intervals are supported: ' + type.values.join(', '));
        }

        schedule = type.encode(frequencyValue);
    }

    var createWebtask = WebtaskCreator(args, {
        onGeneration: onGeneration,
    });
    var logger = createLogger(args, profile);

    return createWebtask(profile);


    function onGeneration(build) {
        if (args.watch) {
            logger.log({ generation: build.generation, container: build.webtask.container }, 'Webtask created: %s. Scheduling cron job...', build.webtask.url);
        }

        return build.webtask.createCronJob({ schedule, state: args.state, meta: args.meta })
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
                        meta: job.meta,
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
