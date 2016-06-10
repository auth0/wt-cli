var _ = require('lodash');

module.exports = function (args, field) {
    args[field] = _.reduce(args[field], function (acc, entry) {
        var parts = entry.split('=');

        return _.set(acc, parts.shift(), parts.join('='));
    }, {});
};