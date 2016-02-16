var Cli = require('structured-cli');
var ConfigFile = require('../../lib/config');
var Pad = require('pad');
var PrintCronJob = require('../../lib/printCronJob');
var _ = require('lodash');


module.exports = Cli.createCommand('history', {
    description: 'Review cron job history',
    handler: handleCronHistory,
    options: {
        profile: {
            alias: 'p',
            description: 'Webtask profile to use',
            type: 'string',
        },
        container: {
            alias: 'c',
            description: 'Overwrite the profile\'s webtask container',
            type: 'string',
        },
        output: {
            alias: 'o',
            description: 'Set the output format',
            choices: ['json'],
            type: 'string',
        },
        fields: {
            description: 'Only print the indicated fields (comma-separated list)',
            defaultValue: 'scheduled_at,started_at,completed_at,type,statusCode,body',
            type: 'string',
        },
        offset: {
            description: 'Skip this many history entries',
            type: 'number',
            defaultValue: 0,
        },
        limit: {
            description: 'Limit the result-set to this many entries',
            type: 'number',
            defaultValue: 20,
        },
    },
    params: {
        name: {
            description: 'Name of the cron job',
            type: 'string',
            required: true,
        }
    }
});


// Command handler

function handleCronHistory(args) {
    var config = new ConfigFile();

    return config.getProfile(args.profile)
        .then(onProfile);
        
    
    function onProfile(profile) {
        return profile.getCronJobHistory({
            container: args.container || profile.container,
            name: args.name,
            offset: args.offset,
            limit: args.limit,
        })
            .then(onCronJobHistory, onCronError);
    }
    
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
