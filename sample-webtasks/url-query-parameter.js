/**
* Access URL query parameters
*/

module.exports = 
    function (context, cb) {
        cb(null, 'Hello, ' + (context.data.name || 'Anonymous'));
    }
