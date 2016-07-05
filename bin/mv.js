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
    var source = {
        name: name,
        container: profile.container,
        profile: profile.name
    };

    if (equal(source, target)) {
        throw Cli.error.invalid('Webtasks are identical. Use a different target name, container or profile.');
    }

    return read(profile, name)
        .then(function(webtask) {
            return copy(profile, webtask, target);
        })
        .then(function() {
            return profile.removeWebtask({
                name: name
            });
        });
}

function equal(source, target) {
    return _.isEqual(source, {
        name: target.name,
        container: target.container || source.container,
        profile: target.profile || source.profile
    });
}

function read(profile, name) {
    return profile.inspectWebtask({
            name: name,
            decrypt: true,
            fetch_code: true
        })
        .catch(function(err) {
            if (err.statusCode === 404) {
                throw Cli.error.notFound('No such webtask: ' + Chalk.bold(name));
            }
            throw err;
        });
}

function copy(profile, webtask, target) {
    if (!webtask.jtn) {
        throw Cli.error.cancelled('Not a named webtask.');
    }
    var targetProfile = profile;
    var claims = _(webtask).omit(['jti', 'iat', 'ca']).value();
    var hasInlineCode = url.parse(webtask.url).protocol === 'webtask:';
    if (hasInlineCode) {
        delete claims.url;
    } else {
        delete claims.code;
    }
    claims.jtn = target.name || claims.jtn;
    claims.ten = target.container || claims.ten;

    var pendingCreate;
    if (target.profile) {
        pendingCreate = loadProfile(target.profile)
            .then(function(profile) {
                targetProfile = profile;
                claims.ten = target.container || profile.container || claims.ten;
                return targetProfile.createRaw(claims);
            });
    } else {
        pendingCreate = targetProfile.createRaw(claims);
    }

    return pendingCreate
        .then(function() {
            target.profile = targetProfile;
            target.name = claims.jtn;
            return moveCronJob(profile, webtask.jtn, target);
        })
        // .then(copyStorage)
        .catch(function(err) {
            throw Cli.error.cancelled('Failed to create webtask. ' + err);
        });
}

function loadProfile(name) {
    var config = new ConfigFile();

    return config.getProfile(name);
}

function moveCronJob(profile, name, target) {
    return coroutine(function*() {
        var cronJobs = yield profile.listCronJobs();

        for (let job of cronJobs) {
            if (job.name === name) {
                let token = yield profile.getWebtask({
                    name: target.name
                });
                yield target.profile.createCronJob({
                    name: target.name,
                    container: target.container,
                    token: token.token,
                    schedule: job.schedule
                });
                yield profile.removeCronJob({
                    name: name
                });
                break;
            }
        }
    })();
}

// TODO: copy built-in data
// function copyStorage() {
//     console.log('DEBUG: copyStorage:');
// }