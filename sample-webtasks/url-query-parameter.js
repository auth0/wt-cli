/* URL query parameters are passed through context.data */

module.exports = 
    function (context, cb) {
        cb(null, 'Hello, ' + (context.data.name || 'Anonymous'));
    }