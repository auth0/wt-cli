var program = require('commander')
    , logger = program.wt.logger
    , async = require('async')
    , url = require('url')
    , jws = require('jws')
    , fs = require('fs')
    , path = require('path')
    , request = require('request');

var types = /^(all|token|url|)$/;
var container_limits = {
    second: 'ls',
    minute: 'lm',
    hour: 'lh',
    day: 'ld',
    week: 'lw',
    month: 'lo'
};
var token_limits = {
    second: 'lts',
    minute: 'ltm',
    hour: 'lth',
    day: 'ltd',
    week: 'ltw',
    month: 'lto'
};

program
    .command('create <file_or_url>')
    .description('create webtask from code')
    .option('-s --secret <key_value>', 'secret(s) to provide to code at runtime', program.wt.collect_hash('secret'), {})
    .option('-t --type <all|url|token>', 'what to output', program.wt.parse_regex('type', types), 'url')
    .option('-p --profile <name>', 'config profile to use', 'default')
    .option('-w --watch', 'watch for file changes')
    .action(function (file_or_url, options) {
        options.merge = true;
        options.parse = true;
        return create_action(file_or_url, options);
    });

program
    .command('create2 <file_or_url>')
    .description('create webtask from code, for ninjas')
    .option('-s --secret <key_value>', 'secret(s) to provide to code at runtime', program.wt.collect_hash('secret'), {})
    .option('-t --type <all|url|token>', 'what to output', program.wt.parse_regex('type', types), 'url')
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
    .action(create_action);

function create_action(file_or_url, options) {
    var profile;
    if (!options.url || !options.container || !options.token)
        profile = program.wt.ensure_profile(options.profile);    

    options.url = options.url || profile.url;
    options.container = options.container || profile.container;
    options.token = options.token || profile.token;

    if (options.exp !== undefined && options.nbf !== undefined
        && options.exp <= options.nbf) {
        console.log('The `nbf` parameter cannot be set to a later time than `exp`.'.red);
        process.exit(1);
    }

    var fol = file_or_url.toLowerCase();
    if (fol.indexOf('http://') === 0 || fol.indexOf('https://') === 0) {
        options.code_url = file_or_url;
        if (options.watch) {
            console.log(('The --watch option can only be used when a file name is specified.').red);
            process.exit(1);
        }
    }
    else {
        options.file_name = path.resolve(process.cwd(), file_or_url);
        if (!fs.existsSync(options.file_name)) {
            console.log(('File ' + options.file_name + ' not found.').red);
            process.exit(1);
        }
        options.code = fs.readFileSync(options.file_name, 'utf8');
    }

    var dirty, pending, generation = 1;
    if (options.watch) {
        fs.watch(options.file_name, function () {
            logger.info({ generation: generation }, 'file changed detected');
            options.code = fs.readFileSync(options.file_name, 'utf8');
            if (pending)
                dirty = true;
            else
                create_one();
        });
    }

    create_one();

    function create_one() {
        dirty = false;

        var params = {
            ten: options.container,
            dd: options.issuanceDepth,
        }

        if (options.code_url)
            params.url = options.code_url;
        if (options.code) 
            params.code = options.code;
        if (options.secret && Object.keys(options.secret).length > 0)
            params.ectx = options.secret;
        if (options.param && Object.keys(options.param).length > 0)
            params.pctx = options.param;
        if (options.nbf !== undefined)
            params.nbf = options.nbf;
        if (options.exp !== undefined)
            params.exp = options.exp;
        if (options.merge)
            params.mb = 1;
        if (options.parse)
            params.pb = 1;
        if (!options.selfRevoke)
            params.dr = 1;

        if (options.tokenLimit)
            add_limits(options.tokenLimit, token_limits);
        if (options.containerLimit)
            add_limits(options.containerLimit, container_limits);

        function add_limits(limits, spec) {
            for (var l in limits) {
                if (!spec[l]) {
                    console.log(('Unsupported limit type `' + l + '`. Supported limits are: ' + Object.keys(spec).join(', ') + '.').red);
                    process.exit(1);
                }
                if (isNaN(limits[l]) || Math.floor(+limits[l]) !== +limits[l] || +limits[l] < 1) {
                    console.log(('Unsupported limit value for `' + l + '` limit. All limits must be positive integers.').red);
                    process.exit(1);
                }
                params[spec[l]] = +limits[l];
            }
        }

        pending = true;
        request({
            url: options.url + '/api/tokens/issue',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + options.token
            },
            body: JSON.stringify(params)
        }, function (error, res, body) {
            pending = false;
            if (error) {
                console.log(('Failed to create a webtask: ' + error.message).red);
                process.exit(1);
            }
            if (res.statusCode !== 200) {
                console.log(('Failed to create a webtask. HTTP ' + res.statusCode + ':').red);
                try {
                    body = JSON.stringify(JSON.parse(body), null, 2);
                }
                catch (e) {}
                console.log(body.red);
                process.exit(1);
            }

            if (options.watch) {
                logger.info({ generation: generation++ }, 'webtask created');
            }
            var webtask_url = options.url + '/api/run/' + options.container + '?key=' + body;
            if (options.type === 'token') {
                console.log(body);
            }
            else if (options.type === 'url') {
                console.log(webtask_url);
            }
            else {
                console.log('Webtask token:'.green);
                console.log(body);
                console.log('Webtask URL:'.green);
                console.log(webtask_url);
            }
            if (dirty)
                create_one();
        });
    }
}
