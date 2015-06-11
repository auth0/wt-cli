var program = require('commander')
    , logger = program.wt.logger
    , async = require('async')
    , promptly = require('promptly')
    , url = require('url')
    , jws = require('jws')
    , fs = require('fs')
    , request = require('request');

program
    .command('init')
    .description('ready, set, go!')
    .option('-t --token <webtask_token>', 'webtask token')
    .option('-c --container <webtask_container>', 'default webtask container')
    .option('-p --profile <profile_name>', 'name of the profile to set up', 'default')
    .option('-q --quiet', 'non-interactive use')
    .action(init_action);

function init_action(options) {
    // logger.info({ 
    //     token: options.token,
    //     container: options.container,
    //     profile: options.profile,
    //     quiet: options.quiet
    // }, 'init');

    var phone, verification_code, profile;
    async.series([
        function (cb) {
            if (!program.wt.config[options.profile])
                return cb();
            console.log('You already have the `' + options.profile + '` profile:');
            program.wt.print_profile(options.profile, program.wt.config[options.profile]);
            promptly.confirm('Do you want to override it? ', function (error, value) {
                if (error) return cb(error);
                if (!value) process.exit(1);
                cb();
            });
        },
        function (cb) {
            console.log('Please enter your phone number, we will send you an SMS verification code.');
            promptly.prompt('Phone number:', {
                validator: function (value) {
                    value = value.replace(/ /g, '');
                    if (!value.match(/^\+?[0-9]{1,15}$/))
                        throw new Error('The phone number must start with + followed by country code, area code, and local number.');
                    if (value.indexOf('+') !== 0)
                        value = '+1' + value; // default to US
                    return value;
                }
            }, function (error, data) {
                if (error) return cb(error);
                phone = data;
                cb();
            })
        },
        function (cb) {
            run_sms_webtask({
                phone: phone
            }, cb);
        },
        function (cb) {
            console.log('Please enter the verification code we sent to ' + phone + ' below.');
            promptly.prompt('Verification code:', function (error, data) {
                if (error) return cb(error);
                verification_code = data;
                cb();
            });
        },
        function (cb) {
            run_sms_webtask({
                phone: phone,
                verification_code: verification_code
            }, function (error, user) {
                if (error) return cb(error);
                var webtask;
                try {
                    webtask = jws.decode(user.id_token).payload.webtask;
                    if (!webtask) throw "No webtask";
                }
                catch (e) {
                    return cb(new Error('Unexpected response from server.'));
                }
                var profile = program.wt.config[options.profile] = {
                    url: webtask.url,
                    token: webtask.token,
                    container: webtask.tenant
                };
                fs.writeFileSync(
                    program.wt.config_file, 
                    JSON.stringify(program.wt.config, null, 2),
                    'utf8');
                program.wt.print_profile(options.profile, profile);
                cb();
            });
        }
    ], function (error) {
        if (error) {
            logger.error({
                message: error.message,
                details: error.details,
                code: error.code
            }, 'intialization failed');
            process.exit(1);
        }
        console.log('Welcome to webtasks! You can create one with `wt create`.'.green);
    });
}

var sms_webtask_token = 'eyJhbGciOiJIUzI1NiIsImtpZCI6IjIifQ.eyJqdGkiOiIyOTY5N2Y2MzM2ZTI0MWFjYTIxNjc1ZmE4ZWNmMjQ0MSIsImlhdCI6MTQzMzU0NzU2NCwiZHIiOjEsImNhIjpbXSwiZGQiOjAsInVybCI6Imh0dHBzOi8vY2RuLmF1dGgwLmNvbS93ZWJ0YXNrcy9zbXNfdmVyaWZpY2F0aW9uLmpzIiwidGVuIjoiYXV0aDAtd2VidGFzay1jbGkiLCJlY3R4IjoiK3BXR2MweFluUzV3V0laVlZOVjB5MmsyYitFY1MvbC9nTmwrc21ERkR6anFtdEp3RGl1a1JPMzcwVjZOUTJIZlc0am90YTQ0SXdDUE9iYUxneGhJc3pvWEVqdVAza1ZHWmUxZWF4T3BhdjFRelUzSTJRdlk2a1ZVVXM4YkhJMUtMcm52VjNEVjVRb1pJOEoxREErM2tuUDNXc3V4NnlydENPcXlrMUhpVGdFbS83Q1JSUFBmUzVuZTJEMTBKbnlaT2loMis1RTkzeVdidm5LM3F1aHF5VUl6QWlsQW1iSGNLRmpUMjB5OGF0MG03MXBzbm5teXN5K2I4MzJFN2F6aTBNbndTMUZ2UlRaWnNrUVdQdmlrWmpDRWE1bHhKUTBvanNHdklzMmVYRXhYNmxBUFBvTUVWd3k2T1pxYjA2Mzc2Njh4bHczQmRkUm9IUzF5UzZTVGNYcUY1YW42aDhkempxb29OWEF0aFFKeE5wQjN1c0VNcHdZOWxzSmxBNHpTLnhNaitWUGxkYUd5ZHhlcXRNYkJEK0E9PSJ9.cOcejs_Wj4XxpeR8WGxoSpQvec8NhfsScfirFPkATrg';

function run_sms_webtask(payload, cb) {
    request({
        url: url.format({
            protocol: 'https',
            host: 'webtask.it.auth0.com',
            pathname: '/api/run/auth0-webtask-cli',
            query: payload
        }),
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + sms_webtask_token
        },
        timeout: 10000
    }, function (error, res, body) {
        if (error) return cb(error);
        if (res.statusCode !== 200) {
            try {
                body = JSON.parse(body);
            }
            catch (e) {
                body = { message: body, code: res.statusCode };
            }
            return cb(body);
        }
        try {
            body = JSON.parse(body);
        }
        catch (e) {
            return cb({ message: 'Invalid format of webtask response', code: 500 });
        }
        cb(null, body);
    });
}
