var Chalk = require('chalk');
var Decode = require('jwt-decode');
var Pad = require('pad');


module.exports = printProfile;


function printProfile (name, profile, options) {
    var width = 12;
    
    if (!options) options = {};
    
    console.log(Chalk.blue(Pad('Profile:', width)), Chalk.green(name));
    console.log(Chalk.blue(Pad('URL:', width)), profile.url);
    console.log(Chalk.blue(Pad('Container:', width)), profile.container);
    
    if (options.token) {
        console.log(Chalk.blue(Pad('Token:', width)), profile.token);
    }
    
    if (options.details) {
        try {
            var claims = Decode(profile.token);
            var keys = Object.keys(claims).sort();
            keys.forEach(function (key) {
                var name = 'Token.' + key + ':';
                console.log(Chalk.blue(Pad(name, width)), claims[key]);
            });
        } catch (__) {
            console.log(Chalk.red('Token is not a valid JWT'));
        }
    }
}
