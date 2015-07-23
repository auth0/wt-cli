/* 
  wt create httppost.js
  curl --data foo=bar https://webtask.it.auth0.com/api/run/yours/httppost
*/

module.exports = 
    function (context, cb) {
        cb(null, 'Hello, world! ' + context.data.foo);
    }