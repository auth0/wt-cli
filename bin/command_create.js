var program = require('commander')
    , logger = program.wt.logger
    , async = require('async')
    , cron = require('cron-parser')
    , url = require('url')
    , jws = require('jws')
    , fs = require('fs')
    , path = require('path')
    , request = require('request')
    , url = require('url');

var types = /^(all|token|url|)$/;

program
    .command('create <file_or_url>')
    .description('create webtask from code')
    .option('-s --secret <key_value>', 'secret(s) to provide to code at runtime', program.wt.collect_hash('secret'), {})
    .option('-t --type <all|url|token>', 'what to output', program.wt.parse_regex('type', types), 'all')
    .option('-p --profile <name>', 'config profile to use', 'default')
    .option('-w --watch', 'watch for file changes')
    .option('--schedule <cron_string>', 'schedule (in quotes) on which to run the webtask')
    .option('--job <name>', 'name of the scheduled webtask job')
    .action(function (file_or_url, options) {
        options.merge = true;
        options.parse = true;
        return create_action(file_or_url, options);
    });

program
    .command('create2 <file_or_url>')
    .description('create webtask from code, for ninjas')
    .option('-s --secret <key_value>', 'secret(s) to provide to code at runtime', program.wt.collect_hash('secret'), {})
    .option('-t --type <all|url|token>', 'what to output', program.wt.parse_regex('type', types), 'all')
    .option('-p --profile <name>', 'config profile to use', 'default')
    .option('-w --watch', 'watch for file changes')
    .option('--nbf <time>', 'webtask cannot be used before this time', program.wt.parse_time('not_before'))
    .option('--exp <time>', 'webtask cannot be used after this time', program.wt.parse_time('expires'))
    .option('--no-parse', 'do not parse JSON and urlencoded request body')
    .option('--no-merge', 'do not merge body data into context.data')
    .option('--no-self-revoke', 'prevent webtask token from revoking itself')
    .option('--issuance-depth <depth>', 'max depth of issuance chain for new token', program.wt.parse_positive_int('issuance-depth'), 0)
    .option('--param <key_value>', 'nonsecret param(s) to provide to code at runtime', program.wt.collect_hash('param'), {})
    .option('--token-limit <key_value>', 'token rate limit(s)', program.wt.collect_hash('token-limit'), {})
    .option('--container-limit <key_value>', 'container rate limit(s)', program.wt.collect_hash('token-limit'), {})
    .option('--token <token>', 'authorization webtask token')
    .option('--url <url>', 'webtask service URL')
    .option('--container <name>', 'webtask container to run the code in')
    .option('--schedule <cron_string>', 'schedule (in quotes) on which to run the webtask')
    .option('--job <name>', 'name of the scheduled webtask job')
    .action(create_action);

program.actions.create_token = create_action;

function create_action (file_or_url, options) {
    var profile;
    var fullpath;
    var filename;
    if (!options.url || !options.container || !options.token)
        profile = program.wt.ensure_profile(options.profile);    

    options.url = options.url || profile.url;
    options.container = options.container || profile.container;
    options.token = options.token || profile.token;

    var fol = file_or_url.toLowerCase();

    // Early exit for invalid schedules
    if (options.schedule) {
        try {
            cron.parseExpression(options.schedule);
        } catch (__) {
            console.log(('Invalid cron expression: ' + options.schedule).red);
            console.log(__);
            process.exit(1);
        }
    }

    if (fol.indexOf('http://') === 0 || fol.indexOf('https://') === 0) {
        options.code_url = file_or_url;

        fullpath = url.parse(file_or_url).pathname;

        if (options.watch) {
            console.log(('The --watch option can only be used when a file name is specified.').red);
            process.exit(1);
        }
    }
    else {
        options.file_name = path.resolve(process.cwd(), file_or_url);

        fullpath = options.file_name;
        
        if (!fs.existsSync(options.file_name)) {
            console.log(('File ' + options.file_name + ' not found.').red);
            process.exit(1);
        }
        options.code = fs.readFileSync(options.file_name, 'utf8');
    }
    
    // Set an intelligent default job name that is either the --job param
    // or the filename of the webtask file / url, stripped of its extension.
    options.job_name = options.job || path.basename(fullpath, path.extname(fullpath));

    var dirty, pending, generation = 1;
    if (options.watch) {
        fs.watch(options.file_name, function () {
            logger.info({ generation: generation }, 'file changed detected');
            options.code = fs.readFileSync(options.file_name, 'utf8');
            if (pending)
                dirty = true;
            else
                create_one(options);
        });
    }

    create_one(options);

    function create_one (options) {
        dirty = false;
        pending = true;

        program.wt.create_token(options, function (err, data) {
            pending = false;

            if (err) {
                console.log(err.red);
                process.exit(1);
            }

            if (options.watch) {
                logger.info({ generation: generation++ }, 'webtask created');
            }

            if (options.type === 'token') {
                console.log(data.token);
            }
            else if (options.type === 'url') {
                console.log(data.webtask_url);
            }
            else {
                console.log('Webtask token:'.green);
                console.log(data.token);
                console.log('Webtask URL:'.green);
                console.log(data.webtask_url);
            }

            if (options.schedule) {
                console.log('Assigning schedule...');

                options.cron_token = data.token;

                program.cron.schedule(options, function (err, job) {
                    if (err) {
                        console.log(('Error scheduling webtask: ' + err).red);
                        process.exit(1);
                    }

                    console.log(('Job ' + job.name.bold + ' scheduled to run on container '
                        + job.container.bold + ' using schedule ' + job.schedule.bold).green);

                    try {
                        var interval = cron.parseExpression(job.schedule, {
                            currentDate: new Date(job.last_scheduled_at),
                        });
                        var nextRunAt = interval.next();

                        console.log(('Next scheduled run at:' + nextRunAt.toLocaleString().bold).green);
                    } catch (__) {}
                });
            } 

            if (dirty) create_one(options);
        })
    }
}
