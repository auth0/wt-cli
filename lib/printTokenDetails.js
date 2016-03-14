var Chalk = require('chalk');
var Decode = require('jwt-decode');
var Pad = require('pad');


module.exports = printTokenDetails;


function printTokenDetails(claims, options) {
    var WIDTH = 12;

    var keys = Object.keys(claims).sort();
    keys.forEach(function (key) {
        var name = 'Token.' + key + ':';
        console.log(Chalk.blue(Pad(name, WIDTH)), claims[key]);
    });
}
