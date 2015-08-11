/**
 * Read the request body inside a webtask
 * @param {string} foo - String to append to response
 */

/* curl --data foo=bar https://webtask.it.auth0.com/api/run/<your-container>/httppost */

module.exports = 
    function (context, cb) {
        cb(null, 'Hello, world! ' + context.data.foo);
    }
