var outWebstask = require('{webtask}');
var authenticatorMw = require('./routed_auth_mw');

module.exports = authenticatorMw(outWebstask);
