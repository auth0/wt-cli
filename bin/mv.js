'use strict';

const url = require('url');
const _ = require('lodash');
const coroutine = require('bluebird').coroutine;
const debug = require('debug')('wt-cli:mv');
const request = require('superagent');
const Sandbox = require('sandboxjs');
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
        'target-url': {
            description: 'Target url',
            type: 'string',
            dest: 'targetUrl'
        },
        'target-token': {
            description: 'Target token',
            type: 'string',
            dest: 'targetToken'
        },
        'target-profile': {
            description: 'Target profile',
            type: 'string',
            dest: 'targetProfile'
        },
        'no-delete': {
            description: 'Do not delete the source',
            type: 'boolean',
            dest: 'noDelete'
        }
    },
    params: {
        'source-webtask': {
            description: 'Source webtask name',
            type: 'string',
            required: false,
            dest: 'source'
        },
        'target-webtask': {
            description: 'Target webtask name',
            type: 'string',
            required: false,
            dest: 'target'
        },
    },
    handler: handleWebtaskMove,
});

function handleWebtaskMove(args) {
    return coroutine(function*() {
        let options = _(args).pick([
            'targetContainer',
            'targetUrl',
            'targetToken',
            'targetProfile'
        ]).omitBy(_.isNull).value();

        if (!args.source && !args.target && _.isEmpty(options)) {
            throw Cli.error.invalid('wt mv: error: too few arguments; specify a target.');
        }

        let targetList = [];

        if (args.source) {
            targetList.push(args.source);
        }

        if (targetList.length === 0) {
            let webtaskList = yield args.profile.listWebtasks({all: true});
            if (!webtaskList) return;
            for (const webtask of webtaskList) {
                targetList.push(webtask.claims.jtn);
            }
        }

        let targetName = args.target || args.source;

        debug('handleWebtaskMove: targetName=%j, targetList=%j', targetName, targetList);

        for (const name of targetList) {
            let target = {
                profile: options.targetProfile,
                url: options.targetUrl,
                token: options.targetToken,
                container: options.targetContainer,
                name: targetName || name
            };
            yield moveWebtask(args.profile, name, target, {noDelete: args.noDelete});
            console.log(chalk.green('Moved webtask: %s'), chalk.bold(name));
        }

    })();
}

function moveWebtask(profile, name, target, options) {
    debug('moveWebtask: profile=%j, name=%s, target=%j', _.omit(profile, 'token'), name, target);

    let sourceWebtask;
    let sourceParams = {
        name: name,
        container: profile.container,
        profile: profile.name,
        url: profile.url,
        token: profile.url
    };

    if (equal(sourceParams, target)) {
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
            return copy(sourceWebtask, data, target, options);
        })
        .then(function () {
            if (options.noDelete) return;
            debug('remove: webtask=%j', sourceWebtask);
            return sourceWebtask.remove();
        });
}

function equal(sourceParams, targetParams) {
    return _.isEqual(sourceParams, {
        name: targetParams.name,
        container: targetParams.container || sourceParams.container,
        profile: targetParams.profile || sourceParams.profile,
        url: targetParams.url || sourceParams.url,
        token: targetParams.token || sourceParams.token
    });
}

function copy(webtask, data, target, options) {
    debug('copy: webtask=%j, data=%j, target=%j', _.omit(webtask, 'token'), data, target);
    if (!data.jtn) throw Cli.error.cancelled('Not a named webtask.');

    return coroutine(function*() {
        target.profile = loadProfile(target.profile, target.url, target.token) || webtask.sandbox;
        target.container = target.container || target.profile.container;
        debug('copy: target.profile=%j', target.profile);

        let claims = cloneWebtaskData(data);
        claims.jtn = target.name || claims.jtn;
        claims.ten = target.container || claims.ten;

        try {
            yield target.profile.createRaw(claims);
            yield moveCronJob(webtask.sandbox, data.jtn, target, _.merge({verify: webtask.token}, options));
            yield copyStorage(webtask, target);
        } catch (err) {
            throw Cli.error.cancelled('Failed to create webtask. ' + err);
        }
    })();
}

function loadProfile(name, url, token) {
    debug('loadProfile: name=%s, url=%j, token=%j', name, url, token);

    let profile;
    let config;

    if (name) {
        config = new ConfigFile();
        profile = config.getProfile(name);
    }

    if (url || token) {
        profile = profile || {};
        profile = Sandbox.init({
            url: url || profile.url,
            container: profile.container || 'default',
            token: token || profile.token
        });
    }

    debug('loadProfile: profile=%j', profile);

    return profile;
}

function moveCronJob(profile, name, target, options) {
    debug('moveCronJob: profile=%j, name=%s, target=%j, options=%j', _.omit(profile, 'token'), name, target, options);

    return coroutine(function*() {
        let job;

        try {
            job = yield profile.getCronJob({name: name});
        } catch (err) {
            if (err.statusCode === 404) return;
            throw err;
        }

        let webtask = yield target.profile.getWebtask({name: target.name, container: target.container});

        if (_.get(options, 'verify') && job.token !== options.verify) {
            console.log(chalk.bold('* Warning: failed to verify the cron job token (no match).'));
        }

        yield target.profile.createCronJob({
            name: target.name,
            container: target.container,
            token: webtask.token,
            schedule: job.schedule,
            state: job.state
        });

        if (!options.noDelete) yield profile.removeCronJob({name: name});
    })();
}

function copyStorage(webtask, target) {
    debug('copyStorage: webtask=%j, target=%j', _.omit(webtask, 'token'), target);

    return coroutine(function*() {
        let body = yield exportStorage(webtask);
        let data = _.get(body, 'data');
        if (!_.isEmpty(data)) {
            yield importStorage(target, {data});
        }
    })();
}

function exportStorage(webtask) {
    debug('exportStorage: webtask=%j', _.omit(webtask, 'token'));

    return coroutine(function*() {
        let url = `${webtask.sandbox.url}/api/webtask/${webtask.claims.ten}/${webtask.claims.jtn}/data`;
        let res = yield request.get(url).set('Authorization', `Bearer ${webtask.sandbox.token}`);

        debug('exportStorage: res.body=%j', res.body);

        return res.body;
    })();
}

function importStorage(webtask, data) {
    debug('importStorage: webtask=%j, data=%j', _.omit(webtask, 'token'), data);

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
