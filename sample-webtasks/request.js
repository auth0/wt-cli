/**
* Shows use of Node.js modules: https://webtask.io/docs/101
* */

var request = require('request');

module.exports = 
    function (cb) {
        var start = Date.now();
        request.get('https://auth0.com', function (error, res, body) {
            if (error)
                cb(error);
            else
                cb(null, {
                    status: res.statusCode,
                    length: body.length,
                    latency: Date.now() - start
                });
        });
    }
