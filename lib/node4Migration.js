var Superagent = require('superagent');

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

