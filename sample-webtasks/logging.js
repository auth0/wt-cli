/**
* Example to test webtask logging. For more on logging see https://webtask.io/docs/api_logs
*/

module.exports = 
    function (context, cb) {
        console.log('foo')
        console.log('request received', context.data);
        cb(null, 'Hello, world');
    }
