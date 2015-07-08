#!/usr/bin/env node

var Cli = require('./cli');

var wt = Cli.createCategory();

wt.command(require('./cron'));
// wt.setErrorHandler(function (err, argv) {
    
// })

console.log(wt.run());