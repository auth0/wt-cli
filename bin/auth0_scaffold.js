var Chalk = require('chalk');
var Cli = require('structured-cli');
var PrintAuth0Extension = require('../lib/printAuth0Extension');
var _ = require('lodash');
var keyValList2Object = require('../lib/keyValList2Object');


module.exports = (extensionName) => { 
    return Cli.createCommand('scaffold', {
        description: 'Scaffold ' + extensionName + ' Auth0 hook code',
        handler: scaffoldHandler(extensionName),
    });


    // Command handler

    function scaffoldHandler(extensionName) { 
        return function (args) {
            console.log(require('./auth0_extensions')[extensionName].template);
        };
    }
};