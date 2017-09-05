var Chalk = require('chalk');
var Pad = require('pad');


module.exports = printCronJob;


function printCronJob(job) {
    var WIDTH = 12;

    console.log(Chalk.blue(Pad('Name:', WIDTH)), Chalk.green(job.name));
    console.log(Chalk.blue(Pad('State:', WIDTH)), job.state);
    console.log(Chalk.blue(Pad('Container:', WIDTH)), job.container);
    console.log(Chalk.blue(Pad('Schedule:', WIDTH)), job.schedule);
    console.log(Chalk.blue(Pad('Timezone:', WIDTH)), job.tz);

    if (job.results && job.results.length) {
        console.log(Chalk.blue(Pad('Last result:', WIDTH)), job.results[0].type);
        console.log(Chalk.blue(Pad('Last run:', WIDTH)), new Date(job.results[0].completed_at).toLocaleString());
    }

    var intervalOptions = {
        currentDate: new Date(job.next_available_at),
    };

    if (job.expires_at) {
        intervalOptions.endDate = new Date(job.expires_at);
    }

    console.log(Chalk.blue(Pad('Next run:', WIDTH)), new Date(job.next_available_at).toLocaleString());

    if (job.expires_at) {
        console.log(Chalk.blue(Pad('Expires:', WIDTH)), new Date(job.expires_at).toLocaleString());
    }

    if (job.meta) {
        for (var m in job.meta) {
            console.log(Chalk.blue(Pad('Meta.' + m + ':', WIDTH)), job.meta[m]);
        }
    }
}
