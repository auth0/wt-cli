var Bluebird = require('bluebird');
var Colors = require('colors');
var Dotenv = require('dotenv');
var Fs = require('fs');
var Parse = require('comment-parser');
var Promptly = require('promptly');
var _ = require('lodash');

Bluebird.promisifyAll(Promptly);

// Resolves null keys to values by asking the user
function promptFor (type, obj) {
    return Bluebird.map(Object.keys(obj), function (key) {
        if(!obj[key]) {
            var promptMethod = type === 'secret'
                ? 'passwordAsync'
                : 'promptAsync';
                
            return Promptly[promptMethod]('Please supply ' + type + ' ' + key.green + ':')
                .then(function (val) {
                    obj[key] = val;
                });
        }
    }, { concurrency: 1 })
        .return(obj);
}

function getFromEnv (key) {
    var dotenvFile; 
    var dotenvObj;

    // Source from process.env
    if(key)
        for (var envKey in Object.keys(process.env))
            if(key === envKey)
                return process.env[envKey];

    // Source from .env
    try {
        dotenvFile = Fs.readFileSync('./.env');
    } catch(e) {
        if((/^ENOENT/).test(e.message))
            if(key)
                return;
            else
                return {};

        throw e;
    }

    dotenvObj = Dotenv.parse(dotenvFile);

    if(!key)
        return dotenvObj;

    for (var dotenvKey in Object.keys(dotenvObj))
        if(key === dotenvKey)
            return dotenvObj[dotenvKey];

    return;
}

function prune (previous, newer) {
    Object.keys(previous)
        .forEach(function (key) {
            if(!newer[key])
                delete previous[key];
        });
}

function getTaskConfig (prevConfig, code) {
    var tags;
    var param = {};
    var secret = {};

    if(!prevConfig)
        prevConfig = {};

    if(!prevConfig.secret)
        prevConfig.secret = {};

    if(!prevConfig.param)
        prevConfig.param = {};

    // Deal with secrets
    try {
        tags = Parse(code)[0].tags;
    } catch(e) {
        secret = getFromEnv();

        if(prevConfig.secret)
            prune(prevConfig.secret, secret);

        // Then there is no config specified, just supply all secrets in .env and get out early
        return Bluebird.resolve(
            _.merge({}, prevConfig, {
                secret: secret,
                param: param
            })
        );
    }

    tags
        .filter(function tag(tag) {
            return tag.type === 'secret';
        })
        .forEach(function (tag) {
            secret[tag.name] = getFromEnv(tag.name);

            if(!secret[tag.name] && prevConfig.secret[tag.name])
                secret[tag.name] = prevConfig.secret[tag.name];
        });

    // Supply all secrets if none are specified in the config
    if(!Object.keys(secret).length)
        secret = _.merge({}, secret, prevConfig.secret, getFromEnv());

    // Deal with params
    tags
        .filter(function (tag) {
            return tag.type === 'string';
        })
        .forEach(function (tag) {
            if(tag.optional) {
                if(tag['default'])
                    param[tag.name] = tag['default'];
            } else {
                if(!prevConfig.param[tag.name])
                    param[tag.name] = getFromEnv(tag.name);

                if(!param[tag.name] && prevConfig.param[tag.name])
                    param[tag.name] = prevConfig.param[tag.name];
            }
        });

    return promptFor('parameter', param)
        .then(function (resolvedParams) {
            return promptFor('secret', secret);
        })
        .then(function (resolvedSecrets) {
            if(prevConfig.param)
                prune(prevConfig.param, param);

            if(prevConfig.secret)
                prune(prevConfig.secret, secret);

            return _.merge({}, prevConfig, {
                param: param,
                secret: secret
            });
        });
}

module.exports = getTaskConfig;
