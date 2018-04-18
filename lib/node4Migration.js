var Superagent = require('superagent');
var Async = require('async');
var Chalk = require('chalk');
var Sandbox = require('sandboxjs');

exports.isNode4Webtask = function isNode4Webtask(webtask) {
    return webtask && webtask.sandbox 
        && exports.isNode4Profile(webtask.sandbox);
};

exports.isNode4Profile = function isNode4Profile(profile) {
    return profile && profile.url 
        && profile.url.match(/^https:\/\/webtask.it.auth0.com\/?$/i);
};

exports.node8BaseUrl = 'https://sandbox.auth0-extend.com';

exports.migrate = function migrate(options, cb) {

    tryMigrate(10);

    function tryMigrate(remainingAttempts) {
        if (remainingAttempts === 0) 
            return cb(new Error('Webtask did not finish migrating within allotted time. Try again.'));
        Superagent
            .post(`https://webtask-migrate.sandbox.auth0-extend.com/${ process.env.WT_MIGRATE_TEST == 1 ? 'test' : 'prod'}`)
            .send({ 
                containerName: options.containerName, 
                webtaskName: options.webtaskName,
                replaceIfExists: true,
                dryRun: options.dryRun,
            })
            .set('Authorization', `Bearer ${options.token}`)
            .end((e,r) => {
    if (process.env.WT_DEBUG == 1)
        console.log('MIGRATE RESPONSE', e && e.message, r && r.statusCode, r && r.body);
                if (e) return cb(e);
                if (r.body.status === 'migrated') {
                    return cb(null, r.body.warnings || []);
                }
                else if (r.body.status === 'failed') {
                    return cb(new Error(r.body.message), r.body.warnings);
                }
                else {
                    process.stdout.write('.');
                    return setTimeout(() => tryMigrate(remainingAttempts - 1), 3000);
                }
            });
    }
};

exports.deleteNode4Assets = function (options) {

    var profile = new Sandbox({
        url: 'https://webtask.it.auth0.com',
        container: options.container,
        token: options.token
    });

    return new Promise(function (resolve, reject) {
        return Async.series([
            (cb) => deleteCronJobs(cb),
            (cb) => deleteWebtasks(cb)
        ], (e) => e ? reject(e) : resolve(null));
    });

    function deleteCronJobs(cb) {
        console.log();
        if (options.keepNode4Cron) {
            console.log('Active Node 4 CRON jobs will continue running since you specified the --keepNode4Cron option.');
            return cb();
        }

        return Async.waterfall([
            (cb) => getAsset('listCronJobs', cb),
            (crons, cb) => doDelete(crons, cb)
        ], cb);

        function doDelete(crons, cb) {
            if (crons.length === 0) {
                console.log('There are no Node 4 CRON jobs to delete.');
            }
            else {
                console.log('Deleting Node 4 CRON jobs:');
            }
            return Async.eachSeries(crons, deleteCron, cb);
        }
    }

    function deleteWebtasks(cb) {
        console.log();
        if (options.keepNode4Webtask) {
            console.log('Node 4 webtasks remain intact since you specified the --keepNode4Webtask option.');
            return cb();
        }

        return Async.waterfall([
            (cb) => getAsset('listWebtasks', cb),
            (webtasks, cb) => doDelete(webtasks, cb)
        ], cb);

        function doDelete(webtasks, cb) {
            if (webtasks.length === 0) {
                console.log('There are no Node 4 webtasks to delete.');
            }
            else {
                console.log('Deleting Node 4 webtasks:');
            }
            return Async.eachSeries(webtasks, deleteWebtask, cb);
        }
    }

    function getAsset(method, cb) {

        var result = [];
        return append();

        function append() {
            profile[method]({ 
                offset: result.length, 
                limit: 100 
            }, (e, d) => {
                if (e) return cb(e);
                if (!d || d.length === 0) return cb(null, result);
                d.forEach(w => result.push(w.toJSON().name));
                append();
            });
        }
    }

    function deleteCron(name, cb) {
        return profile.removeCronJob({ name }, (e) => {
            if (e) {
                if (e.status !== 404) {
                    console.log(Chalk.red(`* Error deleting ${name}: ${e.message}`));
                }
            }
            else {
                console.log(Chalk.green(`* Deleted ${name}`));
            }
            return cb();
        });
    }

    function deleteWebtask(name, cb) {
        return profile.removeWebtask({ name }, (e) => {
            if (e) {
                if (e.status !== 404) {
                    console.log(Chalk.red(`* Error deleting ${name}: ${e.message}`));
                }
            }
            else {
                console.log(Chalk.yellow(`* Deleted ${name}`));
            }
            return cb();
        });
    }
};
