var Chalk = require('chalk');
var Decode = require('jwt-decode');
var Pad = require('pad');


module.exports = printWebtask;


function printWebtask(webtask, options) {
    var WIDTH = 12;
    
    if (!options) options = {};
    
    var json = webtask.toJSON();
    
    console.log(Chalk.blue(Pad('Name:', WIDTH)), Chalk.green(json.name));
    console.log(Chalk.blue(Pad('URL:', WIDTH)), webtask.url);
    // console.log(Chalk.blue(Pad('Container:', WIDTH)), webtask.container);
    
    if (options.token) {
        console.log(Chalk.blue(Pad('Token:', WIDTH)), webtask.token);
    }

    if (webtask.meta) {
        for (var m in webtask.meta) {
            console.log(Chalk.blue(Pad('Meta.' + m + ':', WIDTH)), webtask.meta[m]);
        }
    }
    
    if (options.details) {
        try {
            var claims = Decode(webtask.token);
            var keys = Object.keys(claims).sort();
            keys.forEach(function (key) {
                var name = 'Token.' + key + ':';
                console.log(Chalk.blue(Pad(name, WIDTH)), claims[key]);
            });
        } catch (__) {
            console.log(Chalk.red('Token is not a valid JWT'));
        }
    }
}
