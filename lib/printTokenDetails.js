var Chalk = require('chalk');
var Decode = require('jwt-decode');
var Pad = require('pad');


module.exports = printTokenDetails;


function printTokenDetails(claims, options) {
    var WIDTH = 12;

    var keys = Object.keys(claims).sort();
    var meta = null;
    keys.forEach(function (key) {
        if (key === 'meta') {
            meta = claims[key];
            return;
        }
        
        console.log(Chalk.blue(Pad(`Token.${Chalk.bold(key)}:`, WIDTH)), claims[key]);
    });
    
    if (meta) {
        Object.keys(meta)
            .forEach(key => {
                console.log(Chalk.blue(Pad(`Meta.${Chalk.bold(key)}:`, WIDTH)), meta[key]);
            });
    }
}
