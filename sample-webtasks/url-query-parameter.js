/**
* Shows use of URL query parameters
* @param {string} [name] - Optional name to greet
*/

module.exports = 
    function (context, cb) {
        cb(null, 'Hello, ' + (context.data.name || 'Anonymous'));
    }
