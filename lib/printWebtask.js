'use strict';

const Chalk = require('chalk');
const Decode = require('jwt-decode');
const Pad = require('pad');


module.exports = printWebtask;


function printWebtask(webtask, options) {
    const WIDTH = 12;
    
    if (!options) options = {};
    
    const json = webtask.toJSON();
    
    console.log(Chalk.blue(Pad('Name:', WIDTH)), Chalk.green(json.name));
    console.log(Chalk.blue(Pad('URL:', WIDTH)), webtask.url);
    // console.log(Chalk.blue(Pad('Container:', WIDTH)), webtask.container);
    
    if (options.token) {
        console.log(Chalk.blue(Pad('Token:', WIDTH)), webtask.token);
    }

    if (webtask.meta) {
        for (var m in webtask.meta) {
            console.log(Chalk.blue(Pad(`Meta.${Chalk.bold(m)}:`, WIDTH)), webtask.meta[m]);
        }
    }
    
    if (options.details) {
        try {
            const claims = Decode(webtask.token);
            const keys = Object.keys(claims).sort();
            keys.forEach(key => {
                console.log(Chalk.blue(Pad(`Token.${Chalk.bold(key)}:`, WIDTH)), claims[key]);
            });
        } catch (__) {
            console.log(Chalk.red('Token is not a valid JWT'));
        }
    }
}
