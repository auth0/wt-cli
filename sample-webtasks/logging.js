/* `wt logs` -- will stream your logs to the console
  More on logging: https://webtask.io/docs/api_logs */

module.exports = 
    function (context, cb) {
        console.log('foo')
        console.log('request received', context.data);
        cb(null, 'Hello, world');
    }