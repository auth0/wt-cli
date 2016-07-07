'use strict';

var url = require('url');
var _ = require('lodash');
var coroutine = require('bluebird').coroutine;
var Chalk = require('chalk');
var Cli = require('structured-cli');
var ConfigFile = require('../lib/config');

module.exports = Cli.createCommand('mv', {
    description: 'Move a named webtask',
    plugins: [
        require('./_plugins/profile'),
    ],
    options: {
        'target-container': {
            description: 'Target container',
            type: 'string',
            dest: 'targetContainer'
        },
        'target-profile': {
            description: 'Target profile',
            type: 'string',
            dest: 'targetProfile'
        },
    },
    params: {
        'source': {
            description: 'Source webtask name',
            type: 'string',
            required: true,
        },
        'target': {
            description: 'Target webtask name',
            type: 'string',
            required: false,
        },
    },
    handler: handleWebtaskMove,
});

function handleWebtaskMove(args) {
    var options = _(args).pick(['targetContainer', 'targetProfile']).omitBy(_.isNull).value();
    var targetName = args.target || args.source;

    return moveWebtask(args.profile, args.source, {
        profile: options.targetProfile,
        container: options.targetContainer,
        name: targetName
    }).then(function() {
        console.log(Chalk.green('Moved webtask: %s'), Chalk.bold(targetName));
    });
}

function moveWebtask(profile, name, target) {
    var sourceWebtask;

    if (equal({
            name: name,
            container: profile.container,
            profile: profile.name
        }, target)) {
        throw Cli.error.invalid('Webtasks are identical. Use a different target name, container or profile.');
    }

    return profile.getWebtask({
            name: name
        })
        .catch(function(err) {
            if (err.statusCode === 404) {
                throw Cli.error.notFound('No such webtask: ' + Chalk.bold(name));
            }
            throw err;
        })
        .then(function(webtask) {
            sourceWebtask = webtask;
            return webtask.inspect({
                decrypt: true,
                fetch_code: true
            });
        })
        .then(function(data) {
            return copy(sourceWebtask, data, target);
        })
        .then(function() {
            return sourceWebtask.remove();
        });
}

function equal(sourceParams, targetParams) {
    return _.isEqual(sourceParams, {
        name: targetParams.name,
        container: targetParams.container || sourceParams.container,
        profile: targetParams.profile || sourceParams.profile
    });
}

function copy(webtask, data, target) {
    if (!data.jtn) {
        throw Cli.error.cancelled('Not a named webtask.');
    }

    var claims = cloneWebtaskData(data);
    claims.jtn = target.name || claims.jtn;
    claims.ten = target.container || claims.ten;

    var pendingCreate;
    if (target.profile) {
        pendingCreate = loadProfile(target.profile)
            .then(function(profile) {
                target.profile = profile;
                claims.ten = target.container || profile.container || claims.ten;
                return target.profile.createRaw(claims);
            });
    } else {
        target.profile = webtask.sandbox;
        pendingCreate = target.profile.createRaw(claims);
    }

    return pendingCreate
        .then(function() {
            target.name = claims.jtn;
            return moveCronJob(webtask.sandbox, data.jtn, target, {
                verify: webtask.token
            });
        })
        .then(function() {
            return copyStorage(webtask, target);
        })
        .catch(function(err) {
            throw Cli.error.cancelled('Failed to create webtask. ' + err);
        });
}

function loadProfile(name) {
    var config = new ConfigFile();

    return config.getProfile(name);
}

function moveCronJob(profile, name, target, options) {
    return coroutine(function*() {
        var job;

        try {
            job = yield profile.getCronJob({
                name: name
            });
        } catch (err) {
            if (err.statusCode === 404) {
                return;
            }
            throw err;
        }

        let webtask = yield profile.getWebtask({
            name: target.name,
            container: target.container
        });

        if (_.get(options, 'verify') && job.token !== options.verify) {
            console.log(Chalk.bold('* Warning: failed to verify the cron job token (no match).'));
        }

        yield target.profile.createCronJob({
            name: target.name,
            container: target.container,
            token: webtask.token,
            schedule: job.schedule
        });

        yield profile.removeCronJob({
            name: name
        });
    })();
}

function copyStorage(webtask, target) {
    return coroutine(function*() {
        let targetWebtask = yield target.profile.getWebtask({
            name: target.name,
            container: target.container
        });
        let data = yield exportStorage(webtask);
        yield importStorage(targetWebtask, data);
    })();
}

function exportStorage(webtask) {
    var code = `module.exports = function(ctx, done) {
        ctx.storage.get(function(err, data) {
            if (err) { return done(err); } done(null, data || {});
        });
    }`;

    return ephemeralRun(webtask, code)
        .then(function(res) {
            return JSON.parse(_.get(res, 'text', '{}'));
        });
}

function importStorage(webtask, data) {
    var code = `module.exports = function(ctx, done) {
        ctx.storage.get(function(err, data) {
            if (err) { return done(err); }
            if (!ctx.body) { return done(); }
            ctx.storage.set(ctx.body, { force: 1 }, function(err) {
                if (err) { return done(err); } done();
            });
        });
    }`;

    return ephemeralRun(webtask, code, data)
        .then(function(res) {
            return JSON.parse(_.get(res, 'text', '{}'));
        });
}

function cloneWebtaskData(data) {
    var clone = _(_.clone(data)).omit(['jti', 'iat', 'ca']).value();
    if (url.parse(data.url).protocol === 'webtask:') {
        delete clone.url;
    } else {
        delete clone.code;
    }

    return clone;
}

function ephemeralRun(webtask, code, body, headers) {
    headers = headers || {
        'Content-Type': 'application/json'
    };

    return coroutine(function*() {
        let data = yield webtask.inspect({
            decrypt: true,
            fetch_code: true
        });
        let claims = cloneWebtaskData(data);

        claims.code = code;
        delete claims.url;

        try {
            yield webtask.sandbox.createRaw(claims);
            return yield webtask.run({
                body: body,
                headers: headers
            });
        } finally {
            yield webtask.sandbox.createRaw(cloneWebtaskData(data));
        }
    })();
}