/** 
 * Logging example, try running `wt logs` to stream your logs to the console
 */

module.exports = 
    function (context, cb) {
        console.log('foo')
        console.log('request received', context.data);
        cb(null, 'Hello, world');
    }
