'use strict';

const Cli = require('structured-cli');
const Cron = require('../../lib/cron');
const PrintCronJob = require('../../lib/printCronJob');

module.exports = Cli.createCommand('reschedule', {
    description: 'Change the timing of a cron job',
    plugins: [require('../_plugins/profile')],
    optionGroups: {
        'Cron options': {
            schedule: {
                description:
                    'Either a cron-formatted schedule (see: http://crontab.guru/) or an interval of hours ("h") or minutes ("m"). Note that not all intervals are possible.',
                type: 'string',
            },
            state: {
                description: "Set the cron job's state",
                choices: ['active', 'inactive'],
                type: 'string',
            },
            tz: {
                description: `An IANA timezone name (see: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones), relative to which the cron schedule will be calculated. If not specified, the webtask cluster's default timezone is used.`,
                metavar: 'TIMEZONE',
                type: 'string',
            },
        },
    },
    params: {
        name: {
            description: 'The name of the cron job.',
            type: 'string',
            required: true,
        },
    },
    handler: handleCronReschedule,
});

// Command handler

function handleCronReschedule(args) {
    const profile = args.profile;
    const updateOptions = {
        name: args.name,
    };

    if (args.schedule)
        updateOptions.schedule = Cron.parseSchedule(args.schedule);
    if (args.state) updateOptions.state = args.state;
    if (args.tz) updateOptions.tz = Cron.parseTimezone(args.tz);

    return profile
        .getCronJob({ name: args.name })
        .then(cronJob =>
            profile.createCronJob({
                meta: cronJob.meta,
                name: args.name,
                schedule: args.schedule
                    ? Cron.parseSchedule(args.schedule)
                    : cronJob.schedule,
                state: args.state || cronJob.state,
                token: cronJob.token,
                tz: args.tz ? Cron.parseTimezone(args.tz) : cronJob.tz,
            })
        )
        .tap(cronJob => PrintCronJob(cronJob));
}
