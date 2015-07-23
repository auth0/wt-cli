module.exports = 
    function (context, cb) {
        cb(null, 'Hello, world! ' + context.data.foo);
    }