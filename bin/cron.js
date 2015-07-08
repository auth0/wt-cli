var Bluebird = require('bluebird');
var Cli = require('./cli');
var Create = require('./create');
var Webtask = require('../');
var _ = require('lodash');

var cron = module.exports =
    Cli.createCategory('cron', 'Manage scheduled webtasks');

cron.command(Cli.createCommand('schedule', 'Schedule a webtask to run periodically.', {
	params: '<schedule> <file_or_url>',
	setup: function (yargs) {
	    Create.options.setup(yargs);
	},
	options: _.extend({}, Create.options.options, {
        // container: {
        //     alias: 'c',
        //     description: 'webtask container where the job is running',
        //     type: 'string',
        // },
        json: {
            alias: 'j',
            description: 'json output',
            type: 'boolean',
        },
	}),
	handler: handleCronSchedule,
}));

cron.command(Cli.createCommand('rm', 'Remove a scheduled webtask.', {
    params: '<job_name>',
	options: {
        profile: {
            alias: 'p',
            description: 'name of the profile to use',
            'default': 'default',
            type: 'string',
        },
        json: {
            alias: 'j',
            description: 'json output',
            type: 'boolean',
        },
        // container: {
        //     alias: 'c',
        //     description: 'webtask container where the job is running',
        //     type: 'string',
        // },
    },
	handler: handleCronRemove,
}));

cron.command(Cli.createCommand('ls', 'List scheduled webtasks.', {
	options: {
        profile: {
            alias: 'p',
            description: 'name of the profile to use',
            'default': 'default',
            type: 'string',
        },
        // container: {
        //     alias: 'c',
        //     description: 'webtask container where the job is running',
        //     type: 'string',
        // },
        json: {
            alias: 'j',
            description: 'json output',
            type: 'boolean',
        },
    },
	handler: handleCronList,
}));

cron.command(Cli.createCommand('get', 'Get information about a scheduled webtask.', {
    params: '<job_name> [field]',
	options: {
        profile: {
            alias: 'p',
            description: 'name of the profile to use',
            'default': 'default',
            type: 'string',
        },
        json: {
            alias: 'j',
            description: 'json output',
            type: 'boolean',
        },
        // container: {
        //     alias: 'c',
        //     description: 'webtask container where the job is running',
        //     type: 'string',
        // },
    },
	handler: handleCronGet,
}));

cron.command(Cli.createCommand('history', 'Get information about a scheduled webtask.', {
    params: '<job_name>',
	options: {
        profile: {
            alias: 'p',
            description: 'name of the profile to use',
            'default': 'default',
            type: 'string',
        },
        json: {
            alias: 'j',
            description: 'json output',
            type: 'boolean',
        },
        fields: {
            description: 'only print the indicated fields (comma-separated list)',
            'default': 'created_at,type,statusCode,body',
            type: 'string',
        }
        // container: {
        //     alias: 'c',
        //     description: 'webtask container where the job is running',
        //     type: 'string',
        // },
    },
	handler: handleCronHistory,
}));


module.exports = cron;

function handleCronSchedule (argv) {
    // Prevent `wt create` from outputting
    argv.output = 'none';
    
    var config = Webtask.configFile();
    
    return config.load()
        .then(function (profiles) {
            if (_.isEmpty(profiles)) {
                throw new Error('You must create a profile to begin using '
                    + 'this tool: `wt profile init`.');
            }
            
            return Bluebird.all([
                config.getProfile(argv.profile),
                Create.options.handler(argv)
            ]);
        })
        .spread(function (profile, tokenData) {
            return profile.createCronJob({
                container: argv.container || profile.container,
                name: argv.name || 'webtask',
                token: tokenData.token,
                schedule: argv.params.schedule,
            });
        })
        .tap(function (job) {
            if (argv.json) console.log(job);
            else printCronJob(job);
        });
    
}

function handleCronRemove (argv) {
    var config = Webtask.configFile();
    
    return config.load()
        .then(function (profiles) {
            if (_.isEmpty(profiles)) {
                throw new Error('You must create a profile to begin using '
                    + 'this tool: `wt profile init`.');
            }
            
            return config.getProfile(argv.profile);
        })
        .then(function (profile) {
            return profile.removeCronJob({
                container: argv.container || profile.container,
                name: argv.params.job_name,
            });
        })
        .tap(function () {
            if (argv.json) console.log(true);
            else console.log(('Successfully removed the job ' + argv.params.job_name).green);
        });
    
}

function handleCronList (argv) {
    var config = Webtask.configFile();
    var container;
    
    return config.load()
        .then(function (profiles) {
            if (_.isEmpty(profiles)) {
                throw new Error('You must create a profile to begin using '
                    + 'this tool: `wt profile init`.');
            }
            
            return config.getProfile(argv.profile);
        })
        .then(function (profile) {
            container = argv.container || profile.container;
            
            return profile.listCronJobs({
                container: container,
            });
        })
        .tap(function (jobs) {
            if (argv.json) {
                console.log(jobs);
            } else {
                if (!jobs.length) console.log(('No cron jobs scheduled on the '
                    + 'container `' + container + '`.').green);
                else console.log(('Listing cron jobs scheduled on the '
                    + 'container `' + container + '`:\n').green);
                    
                _.forEach(jobs, function (job) {
                    printCronJob(job);
                    console.log(); // Blank line between jobs
                });
            }
        });
    
}

function handleCronGet (argv) {
    var config = Webtask.configFile();
    
    return config.load()
        .then(function (profiles) {
            if (_.isEmpty(profiles)) {
                throw new Error('You must create a profile to begin using '
                    + 'this tool: `wt profile init`.');
            }
            
            return config.getProfile(argv.profile);
        })
        .then(function (profile) {
            return profile.getCronJob({
                container: argv.container || profile.container,
                name: argv.params.job_name,
            });
        })
        .tap(function (job) {
            if (argv.json) {
                var json = argv.params.field
                    ? job[argv.params.field]
                    : job;
                
                if (_.isObject(json)) console.log(json);
                else console.log(JSON.stringify(json));
            } else if (argv.params.field) {
                console.log(job[argv.params.field]);
            } else {
                printCronJob(job);
            }
        });
    
}

function handleCronHistory (argv) {
    var config = Webtask.configFile();
    
    return config.load()
        .then(function (profiles) {
            if (_.isEmpty(profiles)) {
                throw new Error('You must create a profile to begin using '
                    + 'this tool: `wt profile init`.');
            }
            
            return config.getProfile(argv.profile);
        })
        .then(function (profile) {
            return profile.getCronJobHistory({
                container: argv.container || profile.container,
                name: argv.params.job_name,
                offset: argv.offset,
                limit: argv.limit,
            });
        })
        .tap(function (history) {
            var fields = argv.fields.split(',');
            var json = _.map(history, _.partialRight(_.pick, fields));
            
            if (argv.json) {
                console.log(json);
            } else {
                _(json).reverse().forEach(function (result) {
                    printCronResult(result);
                    console.log(); // Blank line
                }).value();
            }
        });
    
}


function printCronJob (job) {
    console.log('Name:        '.blue, job.name.green);
    console.log('State:       '.blue, job.state);
    console.log('Container:   '.blue, job.container);
    console.log('Schedule:    '.blue, job.schedule);
    
    if (job.last_result) {
        console.log('Last result: '.blue, job.last_result.type);
        console.log('Last run at: '.blue, new Date(job.last_result.created_at).toLocaleString());
    }
}

function printCronResult (result) {
    if (result.created_at)
        console.log('Timestamp:       '.blue, new Date(result.created_at).toLocaleString().green);
        
    _.forEach(result, function (value, key) {
        if (['created_at', 'body'].indexOf(key) === -1)
            console.log(pad(key + ':', 18).blue, value);
    });
    
    if (result.body)
        console.log('Body:            '.blue, result.body);
}

function pad (prefix, length, padChar) {
    if (!padChar) padChar = ' ';
    
    length -= prefix.length;
    
    var times = Math.floor(length / padChar.length);
    
    return prefix + Array(times).join(padChar);
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