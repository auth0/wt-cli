'use strict';

const Cli = require('structured-cli');
const CreateWebtask = require('../../lib/createWebtask');
const PrintCronJob = require('../../lib/printCronJob');
const ValidateCreateArgs = require('../../lib/validateCreateArgs');

const updateCommand = require('../update');

module.exports = Cli.createCommand('update', {
    description: 'Update the code of a cron webtask',
    plugins: [require('../_plugins/profile')],
    optionGroups: updateCommand.optionGroups,
    options: updateCommand.options,
    params: updateCommand.params,
    handler: handleCronUpdate,
});

// Command handler

function handleCronUpdate(args) {
    args = ValidateCreateArgs(args);

    const profile = args.profile;

    return profile.getCronJob({ name: args.name }).then(cronJob =>
        profile
            .inspectToken({ token: cronJob.token, decrypt: true, meta: true })
            .then(claims => {
                // Set the user-defined options from the inspected webtask's claims
                args.host = claims.host;
                args.merge = claims.mb;
                args.parse = claims.pb;
                args.secrets = claims.ectx;
                args.params = claims.pctx;
                args.meta = claims.meta;

                // Defer to the functionality of the create command
                return CreateWebtask(args, { action: 'updated' });
            })
            .then(webtask =>
                webtask.createCronJob({
                    schedule: cronJob.schedule,
                    state: cronJob.state,
                    meta: cronJob.meta,
                    tz: cronJob.tz,
                })
            )
            .tap(cronJob => PrintCronJob(cronJob))
    );
}
