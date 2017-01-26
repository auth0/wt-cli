var Chalk = require('chalk');
var Cli = require('structured-cli');
var PrintAuth0Extension = require('../lib/printAuth0Extension');
var _ = require('lodash');
var keyValList2Object = require('../lib/keyValList2Object');


module.exports = (extensionName) => { 
    return Cli.createCommand('ls', {
        description: 'List ' + (extensionName ? extensionName + ' ' : '') + 'Auth0 hooks',
        plugins: [
            require('./_plugins/profile'),
        ],
        handler: createHandleListAuth0Extensions(extensionName),
        optionGroups: {
            'Pagination': {
                'offset': {
                    type: 'int',
                    description: 'Skip this many hooks',
                    defaultValue: 0,
                },
                'limit': {
                    type: 'int',
                    description: 'Limit the results to this many hooks',
                    defaultValue: 10,
                },
            },
            'Output options': {
                'output': {
                    alias: 'o',
                    description: 'Set the output format',
                    choices: ['json'],
                    type: 'string',
                }
            },
        },
    });


    // Command handler

    function createHandleListAuth0Extensions(extensionName) { 
        return function (args) {
            var profile = args.profile;

            keyValList2Object(args, 'meta');

            var meta = {
                'auth0-extension': 'runtime'
            };
            if (extensionName)
                meta['auth0-extension-name'] = extensionName;
            
            return profile.listWebtasks({ 
                offset: args.offset, 
                limit: args.limit, 
                meta: meta
            })
                .catch(function (err) {
                    if (err.statusCode >= 500) throw Cli.error.serverError(err.message);
                    if (err.statusCode >= 400) throw Cli.error.badRequest(err.message);
                    
                    throw err;
                })
                .then(onWebtasks);
                
            
            function onWebtasks(webtasks) {
                var types = {};
                var count = 0;
                _.forEach(webtasks, function (webtask) {
                    count++;
                    var json = webtask.toJSON();
                    var record = {
                        name: json.name,
                        type: extensionName || (webtask.meta && webtask.meta['auth0-extension-name']) || 'N/A',
                        enabled: !!(webtask.meta && !webtask.meta['auth0-extension-disabled'])
                    };                        
                    if (!types[record.type]) {
                        types[record.type] = [ record ];
                    }
                    else {
                        types[record.type].push(record);
                    }
                });

                if (args.output === 'json') {
                    console.log(JSON.stringify(types, null, 2));
                } else {
                    var typeNames = Object.keys(types).sort();
                    typeNames.forEach(function (type) {
                        console.log(Chalk.blue(type));
                        printExtensions(types[type]);
                        console.log();
                    });

                    function printExtensions(extensions) {
                        extensions.sort(function (a,b) { return a.name > b.name; });
                        extensions.forEach(function (e) {
                            console.log('  ' + e.name + Chalk.green(e.enabled ? ' (enabled)' : ''));
                        })
                    }
                    
                    if (!typeNames.length) {
                        if (args.offset) {
                            console.log('You have fewer than %s hooks.', Chalk.bold(args.offset));
                        } else {
                            console.log(Chalk.green('You do not have any hooks. To get started, try:\n\n'
                                + Chalk.bold('$ auth0 ' + (extensionName || '{extension_type}') + ' scaffold\n')));
                        }
                    } else if (count === args.limit) {
                        console.log(Chalk.green('Successfully listed hooks %s to %s. To list more try:'), Chalk.bold(args.offset + 1), Chalk.bold(args.offset + count));
                        console.log(Chalk.bold('$ auth0 ' + (extensionName ? extensionName + ' ' : '') + 'ls --offset %d'), args.offset + args.limit);
                    } else {
                        console.log(Chalk.green('Successfully listed hooks %s to %s.'), Chalk.bold(args.offset + 1), Chalk.bold(args.offset + count));
                    }
                }
            }
        };
    }
};