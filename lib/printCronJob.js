module.exports = printCronJob;


function printCronJob(job) {
    console.log('Name:        ', job.name);
    console.log('State:       ', job.state);
    console.log('Container:   ', job.container);
    console.log('Schedule:    ', job.schedule);
    
    if (job.results.length) {
        console.log('Last result: ', job.results[0].type);
        console.log('Last run:    ', new Date(job.results[0].completed_at).toLocaleString());
    }
    
    var intervalOptions = {
        currentDate: new Date(job.next_available_at),
    };
    
    if (job.expires_at) {
        intervalOptions.endDate = new Date(job.expires_at);
    }
    
    console.log('Next run:    ', new Date(job.next_available_at).toLocaleString());
    
    if (job.expires_at) {
        console.log('Expires:     ', new Date(job.expires_at).toLocaleString());
    }
}
