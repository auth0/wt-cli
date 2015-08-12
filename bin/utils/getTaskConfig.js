var Colors = require('colors');
var Fs = require('fs');
var Parse = require('comment-parser');
var Dotenv = require('dotenv');
var Bluebird = require('bluebird');
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

function getFromEnv(key) {
    var dotenvFile;
    var dotenvObj;

    // Source from process.env
    if(key)
        for (var envKey of Object.keys(process.env))
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

    for (var dotenvKey of Object.keys(dotenvObj))
        if(key === dotenvKey)
            return dotenvObj[dotenvKey];

    return;
}

function getTaskConfig (argv, code) {
    var tags;
    var param = {};
    var secret = {};

    // Deal with secrets

    try {
        tags = Parse(code)[0].tags;
    } catch(e) {
        // Then there is no config specified, just supply all secrets in .env
        return _.merge(argv, {
            secret: getFromEnv()
        });
    }

    tags
        .filter(function tag(tag) {
            return tag.type === 'secret';
        })
        .forEach(function (tag) {
            if(!argv.secret || !argv.secret[tag.name])
                secret[tag.name] = getFromEnv(tag.name);
        });

    // Supply all secrets if none are specified in the config
    if(!Object.keys(secret).length)
        secret = getFromEnv();

    // Deal with params
    tags
        .filter(function (tag) {
            return tag.type === 'string';
        })
        .forEach(function (tag) {
            if(!tag.optional && (!argv.param || !argv.param[tag.name])) {
                param[tag.name] = getFromEnv(tag.name);
            }
            else if(tag['default']) {
                param[tag.name] = tag['default'];
            }
        });

        return promptFor('parameter', param)
          .then(function (resolvedParams) {
              return promptFor('secret', secret);
          })
          .then(function (resolvedSecrets) {
              return _.merge(argv,{
                  param: param,
                  secret: secret
              });
          });
}

module.exports = getTaskConfig;
