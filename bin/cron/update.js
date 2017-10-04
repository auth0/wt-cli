'use strict';

const Cli = require('structured-cli');
const PrintCronJob = require('../../lib/printCronJob');
const ValidateCreateArgs = require('../../lib/validateCreateArgs');
const WebtaskCreator = require('../../lib/webtaskCreator');

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
            .then(claims => new Promise((resolve, reject) => {
                // Set the user-defined options from the inspected webtask's claims
                args.host = claims.host;
                args.merge = claims.mb;
                args.parse = claims.pb;
                args.secrets = claims.ectx;
                args.params = claims.pctx;
                args.meta = claims.meta;

                const createWebtask = WebtaskCreator(args, {
                    onError: error => reject(error),
                    onGeneration: build => resolve(build.webtask),
                });

                return createWebtask(profile);
            }))
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
