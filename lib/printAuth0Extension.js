var Chalk = require('chalk');
var Decode = require('jwt-decode');
var Pad = require('pad');


module.exports = printAuth0Extension;


function printAuth0Extension(webtask, options) {
    var WIDTH = 12;
    
    options = options || {};

    var json = webtask.toJSON();
    
    console.log(Chalk.blue(Pad('Name:', WIDTH)), Chalk.green(json.name));
    if (options.printType)
        console.log(Chalk.blue(Pad('Type:', WIDTH)), Chalk.green(webtask.type));
    console.log(Chalk.blue(Pad('Enabled:', WIDTH)), webtask.enabled);
}
