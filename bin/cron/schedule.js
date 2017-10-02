'use strict';

const Cli = require('structured-cli');

module.exports = Cli.createCommand('schedule', {
    description: '[DEPRECATED] Please use wt cron create or wt cron update',
    handler: handleCronSchedule,
});

// Command handler

function handleCronSchedule() {
    throw new Cli.error.invalid(
        `The 'wt cron schedule' command has been deprecated in favor of 'wt cron create' and 'wt cron update'.`
    );
}
