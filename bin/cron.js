module.exports = function (yargs) {
	console.log(yargs.argv);

	var argv = yargs
		.usage('Usage: $0 cron <command> [options]')
		.command('list', 'list scheduled webtasks', function (yargs) {
			yargs
				.help('h').alias('h', 'help')
		})
		.help('help')
		.argv;

	console.log('nested', argv);
};

function handleListCron (argv) {
	console.log('listing cron jobs');
}

/// Preserve legacy cron logic to re-integrate:

/*
var program = require('commander')
    , cronParser = require('cron-parser')
    , logger = program.wt.logger
    , fs = require('fs')
    , path = require('path')
    , request = require('request')
    // , humanToCron = require('human-to-cron')
    , url = require('url')
    , _ = require('lodash');

// Enable pretty-printing tables
require('console.table');


program
    .command('cron-list')
    .description('list scheduled webtasks')
    .option('-j --json', 'json output')
    .option('--fields <field1,field2>', 'comma-separated list of fields to show',
        'container,name,state,schedule,run_count,error_count,next_available_at')
    .option('-p --profile <name>', 'config profile to use', 'default')
    .option('--limit [n]', 'limit to [n] jobs', parseInt, 10)
    .option('--offset [n]', 'start at the [n]th job', parseInt, 0)
    .option('--token <token>', 'authorization webtask token')
    .option('--url <url>', 'webtask service URL')
    .option('--container <name>', 'webtask container to run the code in')    
    .action(cron_list);

program
    .command('cron-info <job_name>')
    .description('show information on a scheduled webtask')
    .option('-j --json', 'json output')
    .option('--fields <field1,field2>', 'comma-separated list of fields to show',
        'container,name,state,schedule,run_count,error_count,next_available_at')
    .option('-p --profile <name>', 'config profile to use', 'default')
    .option('--token <token>', 'authorization webtask token')
    .option('--url <url>', 'webtask service URL')
    .option('--container <name>', 'webtask container to run the code in')    
    .action(cron_info);

program
    .command('cron-history <job_name>')
    .description('show history for a scheduled webtask')
    .option('--fields <field1,field2>', 'comma-separated list of fields to show',
        'created_at,type,statusCode,headers,body')
    .option('--limit <n>', 'limit to the [n] last records', parseInt, 10)
    .option('--offset <n>', 'start at the [n]th record', parseInt, 0)
    .option('-j --json', 'json output')
    .option('-p --profile <name>', 'config profile to use', 'default')
    .option('--token <token>', 'authorization webtask token')
    .option('--url <url>', 'webtask service URL')
    .option('--container <name>', 'webtask container to run the code in')    
    .action(cron_history);

program
    .command('cron-delete <job_name>')
    .description('delete a scheduled webtask')
    .option('-p --profile <name>', 'config profile to use', 'default')
    .option('--token <token>', 'authorization webtask token')
    .option('--url <url>', 'webtask service URL')
    .option('--container <name>', 'webtask container to run the code in')    
    .action(cron_delete);

program
    .command('cron <schedule> <file_or_url>')
    .description('schedule a webtask to run periodically. '
        + 'Note: wrap <schedule> in quotes.')
    .option('--job <name>', 'name of the scheduled webtask job')
    .option('-j --json', 'json output')
    .option('-s --secret <key_value>', 'secret(s) to provide to code at runtime', program.wt.collect_hash('secret'), {})
    .option('-p --profile <name>', 'config profile to use', 'default')
    .option('-w --watch', 'watch for file changes')
    .option('-p --profile <name>', 'config profile to use', 'default')
    .option('--token <token>', 'authorization webtask token')
    .option('--url <url>', 'webtask service URL')
    .option('--container <name>', 'webtask container to run the code in')    
    .action(cron_schedule);

program.actions.cron_list = cron_list;
program.actions.cron_info = cron_info;
program.actions.cron_history = cron_history;
program.actions.cron_delete = cron_delete;
program.actions.cron_schedule = cron_schedule;


// Cron related utilities
program.cron = {
    schedule: function (options, cb) {
        ['url', 'container', 'job_name', 'token', 'cron_token', 'schedule']
            .forEach(function (key) {
                if (!options[key]) {
                    console.log('Cron scheduler is missing option:'.red, key.bold);
                    process.exit(1);
                }
            });

        var url = options.url + '/api/cron/' + options.container + '/' + options.job_name;

        request.put(url, {
            json: true,
            headers: {
              'Authorization': 'Bearer ' + options.token
            },
            body: {
                token: options.cron_token,
                schedule: options.schedule,
            },
        }, function (err, rres, job) {
            if (err) return cb('Error making request to webtask scheduler ' + err.message);
            if (rres.statusCode !== 200) return cb('Unexpected response from webtask scheduler'
                + ' with status code ' + rres.statusCode.bold);

            cb(null, job);
        })
    }
};

function cron_list (options) {
    if (!options.url || !options.container || !options.token)
        profile = program.wt.ensure_profile(options.profile);    

    options.url = options.url || profile.url;
    options.container = options.container || profile.container;
    options.token = options.token || profile.token;

    request.get(options.url + '/api/cron/' + options.container, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + options.token
        },
        qs: {
            offset: options.offset,
            limit: options.limit,
        },
        json: true,
    }, function (error, res, jobs) {
        if (error) {
            console.log(('Failed to list scheduled webtasks: ' + error.message).red);
            process.exit(1);
        }
        if (res.statusCode !== 200) {
            console.log(('Failed to list scheduled webtasks. HTTP ' + res.statusCode + ':').red);
            console.log(jobs.red);
            process.exit(1);
        }

        if (!Array.isArray(jobs)) {
            console.log(('Unexpected response type from server.').red);
            console.log(body.red);
            process.exit(1);
        }

        if (options.json) {
            console.log(jobs);
        } else {

            console.log(('Listing '
                + String(jobs.length ? jobs.length : 'no').bold + ' webtasks scheduled on the container '
                + (options.container).bold + ':').green);

            if (jobs.length) {
                var fields = options.fields
                    .split(/[\s,]/);

                console.table(_.map(jobs, _.partialRight(_.pick, fields)));
            }
        } 
    });
}

function cron_info (job_name, options) {
    if (!options.url || !options.container || !options.token)
        profile = program.wt.ensure_profile(options.profile);    

    options.url = options.url || profile.url;
    options.container = options.container || profile.container;
    options.token = options.token || profile.token;

    request.get(options.url + '/api/cron/' + options.container + '/' + job_name, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + options.token
        },
        json: true,
    }, function (error, res, job) {
        if (error) {
            console.log(('Failed to load scheduled webtasks: ' + error.message).red);
            process.exit(1);
        }
        if (res.statusCode !== 200) {
            console.log(('Failed to load scheduled webtasks. HTTP ' + res.statusCode + ':').red);
            console.log(job.red);
            process.exit(1);
        }

        if (options.json) {
            console.log(job);
        } else {
            var fields = options.fields
                .split(/[\s,]/);

            console.table(_.pick(job, fields));
        }
    });
}
function cron_history (job_name, options) {
    if (!options.url || !options.container || !options.token)
        profile = program.wt.ensure_profile(options.profile);    

    options.url = options.url || profile.url;
    options.container = options.container || profile.container;
    options.token = options.token || profile.token;

    request.get(options.url + '/api/cron/' + options.container + '/' + job_name + '/history', {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + options.token
        },
        query: {
            limit: options.limit,
            offset: options.offset,
        },
        json: true,
    }, function (error, res, history) {
        if (error) {
            console.log(('Failed to load scheduled webtask history: ' + error.message).red);
            process.exit(1);
        }
        if (res.statusCode !== 200) {
            console.log(('Failed to load scheduled webtask history. HTTP ' + res.statusCode + ':').red);
            console.log(history.red);
            process.exit(1);
        }

        if (options.json) {
            console.log(history);
        } else {
            var fields = options.fields
                .split(/[\s,]/);

            console.table(_.map(history, _.partialRight(_.pick, fields)));
        }
    });
}

function cron_delete (job_name, options) {
    if (!options.url || !options.container || !options.token)
        profile = program.wt.ensure_profile(options.profile);    

    options.url = options.url || profile.url;
    options.container = options.container || profile.container;
    options.token = options.token || profile.token;

    request.del(options.url + '/api/cron/' + options.container + '/' + job_name, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + options.token
        },
        json: true,
    }, function (error, res, body) {
        if (error) {
            console.log(('Failed to delete the scheduled webtask: ' + error.message).red);
            process.exit(1);
        }
        if (res.statusCode !== 204) {
            console.log(('Failed to delete the scheduled webtask. HTTP ' + res.statusCode + ':').red);
            console.log(body.red);
            process.exit(1);
        }

        console.log(('Job ' + job_name.bold + ' deleted from container '
            + options.container.bold).green);
    });
}

function cron_schedule (schedule, file_or_url, options) {
    options.schedule = schedule;

    return program.actions.create_token(file_or_url, options);
}
*/