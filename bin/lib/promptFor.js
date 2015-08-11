var Bluebird = require('bluebird');
var Promptly = require('promptly');

Bluebird.promisifyAll(Promptly);

// Resolves null keys to values by asking the user
module.exports = function promptFor (type, obj) {
    return Bluebird.map(Object.keys(obj), function (key) {
        if(obj[key] === null) {
            return Promptly.promptAsync('Please supply ' + type + ' ' + key + ':')
                .then(function (val) {
                    obj[key] = val;
                });
        }
    }, { concurrency: 1 })
    .then(function () {
        return obj;
    });
}
