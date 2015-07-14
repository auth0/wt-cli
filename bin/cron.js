var Bluebird = require('bluebird');
var Cli = require('nested-yargs');
var Create = require('./create');
var Webtask = require('../');
var _ = require('lodash');

var cron = module.exports =
    Cli.createCategory('cron', 'Manage scheduled webtasks');

cron.command(Cli.createCommand('schedule', 'Schedule a webtask to run periodically', {
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

cron.command(Cli.createCommand('rm', 'Remove a scheduled webtask', {
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

cron.command(Cli.createCommand('ls', 'List scheduled webtasks', {
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

cron.command(Cli.createCommand('get', 'Get information about a scheduled webtask', {
    params: '<job_name> [field]',
	options: {
        profile: {
            alias: 'p',
            description: 'name of the webtask profile to use',
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
                    + 'this tool: `wt init`.');
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
                    + 'this tool: `wt init`.');
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
                    + 'this tool: `wt init`.');
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
                    + 'this tool: `wt init`.');
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
                    + 'this tool: `wt init`.');
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