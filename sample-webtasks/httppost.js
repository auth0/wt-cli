/** 
* Webtask that uses data from the request body
* @param {string} foo - example context
*/

module.exports = 
    function (context, cb) {
        cb(null, 'Hello, world! ' + context.data.foo);
    }
