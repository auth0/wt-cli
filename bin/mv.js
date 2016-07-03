var url = require('url');
var _ = require('lodash');
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
            description: 'Webtask name',
            type: 'string',
            required: true,
        },
        'target': {
            description: 'Webtask name',
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
    return source.name == target.name && !target.container && !target.profile;
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
        })
        .then(function(webtask) {
            return webtask;
        });
}

// TODO: copy built-in data
// TODO: copy cronjobs schedules
function copy(profile, webtask, target) {
    var create;
    var claims = _(webtask).omit(['jti', 'iat', 'ca']).value();
    var hasInlineCode = url.parse(webtask.url).protocol === 'webtask:';
    if (hasInlineCode) {
        delete claims.url;
    } else {
        delete claims.code;
    }
    claims.jtn = target.name || claims.jtn;
    claims.ten = target.container || claims.ten;

    if (target.profile) {
        create = loadProfile(target.profile)
            .then(function(profile) {
                return profile.createRaw(claims);
            });
    } else {
        create = profile.createRaw(claims);
    }

    return create
        .catch(function(err) {
            throw Cli.error.cancelled('Failed to create webtask. ' + err);
        });
}

function loadProfile(name) {
    var config = new ConfigFile();

    return config.getProfile(name);
}