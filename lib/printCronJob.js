'use strict';

const Chalk = require('chalk');
const Moment = require('moment-timezone');
const Pad = require('pad');


module.exports = printCronJob;


function printCronJob(job) {
    const WIDTH = 12;

    console.log(Chalk.blue(Pad('Name:', WIDTH)), Chalk.green(job.name));
    console.log(Chalk.blue(Pad('State:', WIDTH)), job.state);
    console.log(Chalk.blue(Pad('Container:', WIDTH)), job.container);
    console.log(Chalk.blue(Pad('Schedule:', WIDTH)), job.schedule);
    console.log(Chalk.blue(Pad('Timezone:', WIDTH)), job.tz);

    if (job.results && job.results.length) {
        console.log(Chalk.blue(Pad('Last result:', WIDTH)), job.results[0].type);
        console.log(Chalk.blue(Pad('Last run:', WIDTH)), Moment.tz(job.results[0].completed_at, job.tz).format('L LTS z'));
    }

    console.log(Chalk.blue(Pad('Next run:', WIDTH)), Moment.tz(job.next_available_at, job.tz).format('L LTS z'));

    if (job.expires_at) {
        console.log(Chalk.blue(Pad('Expires:', WIDTH)), Moment.tz(job.expires_at, job.tz).format('L LTS z'));
    }

    if (job.meta) {
        for (let m in job.meta) {
            console.log(Chalk.blue(Pad('Meta.' + m + ':', WIDTH)), job.meta[m]);
        }
    }
}
