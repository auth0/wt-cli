var Parse = require('comment-parser');
var Dotenv = require('dotenv');
var Bluebird = require('bluebird');
var Promptly = require('promptly');
var _ = require('lodash');
var Colors = require('colors');

Bluebird.promisifyAll(Promptly);

// Resolves null keys to values by asking the user
function promptFor (type, obj) {
    return Bluebird.map(Object.keys(obj), function (key) {
        if(obj[key] === null) {
            return Promptly.promptAsync('Please supply ' + type + ' ' + key.green + ':')
                .then(function (val) {
                    obj[key] = val;
                });
        }
    }, { concurrency: 1 })
    .then(function () {
        return obj;
    });
}

function getSecret(key) {
    var secrets = {};
    var value   = ''

    // Source from process.env
    if(key)
        Object
            .keys(process.env)
            .forEach(function (envKey) {
                if(key === envKey)
                    secrets[key] = process.env[key];
            });

    // Source from .env
    var dotenvFile;

    try {
        dotenvFile = Fs.readFileSync('./.env');
    } catch(e) {
        if(key && !secrets[key])
            return null;

        return secrets;
    }

    var dotenvObj = Dotenv.parse(dotenvFile);

    Object
        .keys(dotenvObj)
        .forEach(function (secret) {
            if(!key)
                // Then supply *all* the secrets
                secrets[secret] = dotenvObj[secret];
            else if(secret === key)
                value = dotenvObj[secret];
        });

    if(key) {
        if(value)
            return value;

        return null;
    } else {
        return secrets;
    }
}

function getTaskConfig (argv, code) {
    var tags;
    var param = {};
    var secret = {};

    try {
        tags = Parse(code)[0].tags;
    } catch(e) {
        // Then there is no config specified, just supply all secrets in .env
        return _.merge(argv, {
            secret: getSecret()
        });
    }

    tags
        .filter(function tag(tag) {
            return tag.type === 'secret';
        })
        .forEach(function (tag) {
            secret[tag.name] = getSecret(tag.name);
        });

    // Supply all secrets if none are specified in the config
    if(!Object.keys(secret).length)
        secret = getSecret();

    tags
        .filter(function (tag) {
            return tag.type === 'string';
        })
        .forEach(function (tag) {
            if(!tag.optional && (!argv.param || !argv.param[tag.name])) {
                param[tag.name] = null;
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
