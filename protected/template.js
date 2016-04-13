var outWebstask = require('{webtask}');
var authenticatorMw = require('./dummy');

module.exports = authenticatorMw(outWebstask);
