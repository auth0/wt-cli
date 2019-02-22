'use strict';

const Cli = require('structured-cli');
const Cron = require('../../lib/cron');
const Logs = require('../../lib/logs');
const PrintCronJob = require('../../lib/printCronJob');
const ValidateCreateArgs = require('../../lib/validateCreateArgs');
const WebtaskCreator = require('../../lib/webtaskCreator');
const _ = require('lodash');

const CRON_AUTH_MIDDLEWARE = '@webtask/cron-auth-middleware';
const CRON_AUTH_MIDDLEWARE_VERSION = '^1.2.1';

const createCommand = require('../create');

module.exports = Cli.createCommand('create', {
    description: 'Create a cron webtask',
    plugins: [require('../_plugins/profile')],
    optionGroups: _.extend({}, createCommand.optionGroups, {
        'Cron options': {
            'no-auth': {
                description: 'Disable cron webtask authentication',
                dest: 'noAuth',
                type: 'boolean',
            },
            schedule: {
                description:
                    'Either a cron-formatted schedule (see: http://crontab.guru/) or an interval of hours ("h") or minutes ("m"). Note that not all intervals are possible.',
                type: 'string',
                required: true,
            },
            state: {
                description: "Set the cron job's state",
                choices: ['active', 'inactive'],
                defaultValue: 'active',
                type: 'string',
            },
            tz: {
                description: `An IANA timezone name (see: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones), relative to which the cron schedule will be calculated. If not specified, the webtask cluster's default timezone is used.`,
                metavar: 'TIMEZONE',
                type: 'string',
            },
        },
    }),
    options: _.extend({}, createCommand.options, {}),
    params: createCommand.params,
    epilog: [
        'Examples:',
        '1. Create a webtask that runs every five minutes:',
        '  $ wt cron create --schedule 5m ./sample-webtasks/hello-world.js',
        '2. Create a webtask that runs every Tuesday at 09:05:',
        '  $ wt cron create --schedule "5 9 * * 2" ./sample-webtasks/hello-world.js',
        '3. Create a webtask that runs every Tuesday at 09:05 UTC:',
        '  $ wt cron create --schedule "5 9 * * 2" --tz UTC ./sample-webtasks/hello-world.js',
    ].join('\n'),
    handler: handleCronCreate,
});

// Command handler

function handleCronCreate(args) {
    const profile = args.profile;

    if (!args.noAuth) {
        args.middleware.push(
            `${CRON_AUTH_MIDDLEWARE}@${CRON_AUTH_MIDDLEWARE_VERSION}`
        );
    }

    const tz = args.tz ? Cron.parseTimezone(args.tz): undefined;
    const schedule = Cron.parseSchedule(args.schedule);

    args = ValidateCreateArgs(args);

    const logger = createLogger(args, profile);
    const createWebtask = WebtaskCreator(args, {
        logger,
        onGeneration: onGeneration,
    });

    return createWebtask(profile);

    function onGeneration(build) {
        if (args.watch) {
            logger.log(
                {
                    generation: build.generation,
                    container: build.webtask.container,
                },
                'Webtask created: %s. Scheduling cron job...',
                build.webtask.url
            );
        }

        return build.webtask
            .createCronJob({
                schedule,
                tz,
                state: args.state,
                meta: args.meta,
            })
            .then(onCronScheduled, onCronError);

        function onCronScheduled(job) {
            args.watch
                ? logger.log(
                      {
                          generation: build.generation,
                          container: job.container,
                          state: job.state,
                          schedule: job.schedule,
                          timezone: job.tz,
                          next_available_at: new Date(
                              job.next_available_at
                          ).toLocaleString(),
                          created_at: new Date(job.created_at).toLocaleString(),
                          run_count: job.run_count,
                          error_count: job.error_count,
                          meta: job.meta,
                      },
                      'Cron job scheduled'
                  )
                : PrintCronJob(job, logger);
        }

        function onCronError(err) {
            switch (err.statusCode) {
                case 400:
                    throw Cli.error.invalid(
                        'Invalid cron job; please check that the schedule is a valid cron schedule'
                    );
                default:
                    throw err;
            }
        }
    }
}

function createLogger(args, profile) {
    if (args.watch) {
        return Logs.createLogStream(profile);
    } else {
        return {
            info: function info() { return console.log.apply(console, Array.prototype.slice.call(arguments)); }, // eslint-disable-line no-console
            warn: function warn() { return console.log.apply(console, Array.prototype.slice.call(arguments)); }, // eslint-disable-line no-console
            error: function error() { return console.log.apply(console, Array.prototype.slice.call(arguments)); }, // eslint-disable-line no-console
        };
    }
}
