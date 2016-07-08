var spawn = require('child_process').spawn;

// The function that actually runs the npm
module.exports = function npmCmd(cmd, params){
  var params = [cmd].concat(params).filter(Boolean);
  return new Promise((resolve, reject) => {
    var proc = spawn('npm', params, {
      stdio: 'inherit'
    });
    proc.on('error', reject);
    proc.on('close', resolve);
  });
}
