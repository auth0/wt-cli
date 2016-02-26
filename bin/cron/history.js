var Cli = require('structured-cli');
var Pad = require('pad');
var _ = require('lodash');


module.exports = Cli.createCommand('history', {
    description: 'Review cron job history',
    plugins: [
        require('../_plugins/profile'),
    ],
    outputGroups: {
        'Output options': {
            output: {
                alias: 'o',
                description: 'Set the output format',
                choices: ['json'],
                type: 'string',
            },
            fields: {
                description: 'Only print the indicated fields (comma-separated list).',
                defaultValue: 'scheduled_at,started_at,completed_at,type,statusCode,body',
                type: 'string',
            },
        },
        'Pagination': {
            offset: {
                description: 'Skip this many history entries.',
                type: 'number',
                defaultValue: 0,
            },
            limit: {
                description: 'Limit the result-set to this many entries.',
                type: 'number',
                defaultValue: 20,
            },
        },
    },
    params: {
        name: {
            description: 'Name of the cron job to inspect.',
            type: 'string',
            required: true,
        }
    },
    handler: handleCronHistory,
});


// Command handler

function handleCronHistory(args) {
    var profile = args.profile;
    
    return profile.getCronJobHistory({
        container: args.container || profile.container,
        name: args.name,
        offset: args.offset,
        limit: args.limit,
    })
        .then(onCronJobHistory, onCronError);

    
    function onCronJobHistory(results) {
        if (args.output === 'json') {
            console.log(JSON.stringify(results, null, 2));
        } else {
            var fields = args.fields.split(/\s*,\s*/).filter(Boolean);
            
            _.forEach(results, function (result, i) {
                if (i) console.log();
                
                printCronResult(result, fields);
            });
        }
    }
    
    function onCronError(err) {
        switch (err.statusCode) {
            case 404: throw Cli.error.notFound('No such webtask: ' + args.name);
            default: throw err;
        }
    }
}


function printCronResult(result, fields) {
    _.forEach(fields, function (field) {
        var value = result[field];
        
        if (value) console.log(Pad(field + ':', 18), value);
    });
}
