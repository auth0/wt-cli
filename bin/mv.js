'use strict';

const url = require('url');
const _ = require('lodash');
const coroutine = require('bluebird').coroutine;
const debug = require('debug')('wt-cli:mv');
const request = require('superagent');
const chalk = require('chalk');
const Cli = require('structured-cli');
const ConfigFile = require('../lib/config');

module.exports = Cli.createCommand('mv', {
    description: 'Move a named webtask',
    plugins: [
        require('./_plugins/profile')
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
    let options = _(args).pick(['targetContainer', 'targetProfile']).omitBy(_.isNull).value();
    let targetName = args.target || args.source;

    return moveWebtask(args.profile, args.source, {
        profile: options.targetProfile,
        container: options.targetContainer,
        name: targetName
    }).then(function () {
        console.log(chalk.green('Moved webtask: %s'), chalk.bold(targetName));
    });
}

function moveWebtask(profile, name, target) {
    debug('moveWebtask: profile=%j, name=%s, target=%j',
        _.omit(profile, 'token'), name, target);

    let sourceWebtask;

    if (equal({name: name, container: profile.container, profile: profile.name}, target)) {
        throw Cli.error.invalid('Webtasks are identical. Use a different target name, container or profile.');
    }

    return profile.getWebtask({name: name})
        .catch(function (err) {
            if (err.statusCode === 404) {
                throw Cli.error.notFound('No such webtask: ' + chalk.bold(name));
            }
            throw err;
        })
        .then(function (webtask) {
            sourceWebtask = webtask;
            return webtask.inspect({
                decrypt: true,
                fetch_code: true
            });
        })
        .then(function (data) {
            return copy(sourceWebtask, data, target);
        })
        .then(function () {
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
    debug('copy: webtask=%j, data=%j, target=%j',
        _.omit(webtask, 'token'), data, target);

    if (!data.jtn) {
        throw Cli.error.cancelled('Not a named webtask.');
    }

    let claims = cloneWebtaskData(data);
    claims.jtn = target.name || claims.jtn;
    claims.ten = target.container || claims.ten;

    let pendingCreate;
    if (target.profile) {
        pendingCreate = loadProfile(target.profile)
            .then(function (profile) {
                target.profile = profile;
                target.container = profile.container;
                claims.ten = target.container || claims.ten;
                return target.profile.createRaw(claims);
            });
    } else {
        target.profile = webtask.sandbox;
        target.container = webtask.sandbox.container;
        pendingCreate = target.profile.createRaw(claims);
    }

    return pendingCreate
        .then(function () {
            target.name = claims.jtn;
            return moveCronJob(webtask.sandbox, data.jtn, target, {
                verify: webtask.token
            });
        })
        .then(function () {
            return copyStorage(webtask, target);
        })
        .catch(function (err) {
            throw Cli.error.cancelled('Failed to create webtask. ' + err);
        });
}

function loadProfile(name) {
    debug('loadProfile: name=%s', name);

    let config = new ConfigFile();

    return config.getProfile(name);
}

function moveCronJob(profile, name, target, options) {
    debug('moveCronJob: profile=%j, name=%s, target=%j, options=%j',
        _.omit(profile, 'token'), name, target, options);

    return coroutine(function*() {
        let job;

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
            console.log(chalk.bold('* Warning: failed to verify the cron job token (no match).'));
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
    debug('copyStorage:webtask=%j, target=%j',
        _.omit(webtask, 'token'), target);

    return coroutine(function*() {
        let body = yield exportStorage(webtask);
        let data = _.get(body, 'data');
        if (!_.isEmpty(data)) {
            yield importStorage(target, {data});
        }
    })();
}

function exportStorage(webtask) {
    debug('exportStorage: webtask=%j',
        _.omit(webtask, 'token'));

    return coroutine(function*() {
        let url = `${webtask.sandbox.url}/api/webtask/${webtask.container}/${webtask.claims.jtn}/data`;
        let res = yield request.get(url).set('Authorization', `Bearer ${webtask.sandbox.token}`);

        debug('exportStorage: res.body=%j', res.body);

        return res.body;
    })();
}

function importStorage(webtask, data) {
    debug('importStorage: webtask=%j, data=%j',
        _.omit(webtask, 'token'), data);

    return coroutine(function*() {
        let url = `${webtask.profile.url}/api/webtask/${webtask.container}/${webtask.name}/data`;
        let res = yield request.put(url)
            .set('Authorization', `Bearer ${webtask.profile.token}`)
            .send(data);

        debug('importStorage: res.body=%j', res.body);

        return res.body;
    })();
}

function cloneWebtaskData(data) {
    let clone = _(_.clone(data)).omit(['jti', 'iat', 'ca', 'webtask_url']).value();
    if (url.parse(data.url).protocol === 'webtask:') {
        delete clone.url;
    } else {
        delete clone.code;
    }

    return clone;
}
