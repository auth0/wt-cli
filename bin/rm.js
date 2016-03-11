var Chalk = require('chalk');
var Cli = require('structured-cli');


module.exports = Cli.createCommand('rm', {
    description: 'Remove a named webtask',
    plugins: [
        require('./_plugins/profile'),
    ],
    options: {
        silent: {
            alias: 's',
            description: 'No output',
            type: 'boolean',
        },
    },
    params: {
        'name': {
            description: 'Webtask name',
            type: 'string',
            required: true,
        },
    },
    handler: handleWebtaskRemove,
});


// Command handler

function handleWebtaskRemove(args) {
    var profile = args.profile;


    return profile.removeWebtask({ name: args.name })
        .then(onSuccess, onError);
        
    function onSuccess() {
        if (!args.silent) {
            console.log(Chalk.green('Removed webtask: %s'), Chalk.bold(args.name));
        }
    }
    
    function onError(err) {
        switch (err.statusCode) {
            case 404: throw Cli.error.notFound('No such webtask: ' + Chalk.bold(args.name));
            default: throw err;
        }
    }
}

