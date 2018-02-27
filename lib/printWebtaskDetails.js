var Chalk = require('chalk');
var Pad = require('pad');


module.exports = printWebtaskDetails;


function printWebtaskDetails(webtask) {
    var WIDTH = 12;
    
    var json = webtask.toJSON();

    console.log(Chalk.blue(Pad('Name:', WIDTH)), Chalk.green(json.name));
    console.log(Chalk.blue(Pad('URL:', WIDTH)), json.url);
    console.log(Chalk.blue(Pad('Container:', WIDTH)), json.container);
    
    if (webtask.meta) {
        for (var m in webtask.meta) {
            console.log(Chalk.blue(Pad('Meta.' + m + ':', WIDTH)), webtask.meta[m]);
        }
    }

    Object.keys(webtask.secrets || []).sort().forEach(function (s) {
        console.log(Chalk.blue(Pad('Secret.' + s + ':', WIDTH)), webtask.secrets[s]);
    });

    if (webtask.code) {
        console.log(Chalk.blue('Code:'));
        console.log(webtask.code.trim());
    }
}
