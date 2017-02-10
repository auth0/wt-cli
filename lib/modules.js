'use strict';

const Bluebird = require('bluebird');
const Chalk = require('chalk');
const Child = require('child_process');
const Cli = require('structured-cli');
const Readline = require('readline');
const Progress = require('progress');
const Semver = require('semver');
const Wrap = require('linewrap');
const _ = require('lodash');

const ENSURE_AVAILABLE_TIMEOUT = 1000 * 60 * 5;
const ENSURE_AVAILABLE_INTERVAL = 1000 * 5;

const wrapHint = Wrap(process.stdout.columns, {
    skipScheme: 'ansi-color',
    wrapLineIndent: 2,
});


module.exports = {
    awaitAvailable,
    ensure,
    parseSpec,
    provision,
    resolveSpec,
};

function awaitAvailable(profile, modules, options) {
    const start = Date.now();

    if (!options) {
        options = {};
    }

    if (options.timeout === undefined) {
        options.timeout = ENSURE_AVAILABLE_TIMEOUT;
    }

    if (options.interval === undefined) {
        options.interval = ENSURE_AVAILABLE_INTERVAL;
    }

    return checkAvailability();


    function checkAvailability() {
        if (+options.timeout > 0 && Date.now() > start + options.timeout) {
            return Bluebird.reject(Cli.error.timeout('Timed out waiting for modules to become available'));
        }

        return ensure(profile, modules, options)
            .then(validateAvailability);
    }

    function validateAvailability(results) {
        const failed = _.find(results, module => module.state === 'failed');
        const queued = _.find(results, module => module.state === 'queued');

        if (options.onPoll) {
            try {
                options.onPoll(results);
            } catch (__) {
                // Discard exception
            }
        }

        if (failed) {
            return Bluebird.reject(Cli.error.serverError(`The module ${failed.name}@${failed.version} failed to build.`));
        }

        if (queued) {
            return Bluebird.delay(+options.interval)
                .then(checkAvailability);
        }

        return results;
    }
}

function ensure(profile, modules, options) {
    if (!options) {
        options = {};
    }

    return Bluebird.resolve(profile.ensureNodeModules({ modules, reset: !!options.reset }));
}

function parseSpec(spec) {
    const idx = spec.indexOf('@', 1);
    const name = idx === -1 ? spec : spec.slice(0, idx);
    const range = spec.slice(name.length + 1, spec.length) || '*';

    return { name, range };
}

function resolveSpec(module) {
    const entrypoint = [
        'npm',
        'view',
        module.name,
        'versions',
        '--json',
    ];
    const options = {
        cwd: process.cwd(),
    };
    const execFile = Bluebird.promisify(Child.execFile, {
        multiArgs: true,
    });

    return execFile(entrypoint[0], entrypoint.slice(1), options)
        .catch(() => {
            return Bluebird.reject(Cli.error.notFound(`Error looking up module on npm that satisfies ${module.name}@${module.range}.`));
        })
        .spread((stdout) => JSON.parse(stdout))
        .then(versions => findBestVersion(module.name, module.range, versions));

}

function findBestVersion(name, range, available) {
    if (!Array.isArray(available)) available = [available];

    const version = Semver.maxSatisfying(available, range);

    if (!version) {
        return Bluebird.reject(Cli.error.notFound(`No module version found on npm that satisfies ${name}@${range}.`));
    }

    return { name, version };
}

function provision(profile, modules) {
    return Bluebird.map(modules, resolveSpec)
        .then(modules => {
            const total = Object.keys(modules).length;
            const pluralization = total === 1 ? 'module' : 'modules';
            const progress = new Progress('Provisioning [:bar] :percent', {
                total,
                complete: '=',
                incomplete: ' ',
                width: 30,
            });
            const stateToColor = {
                queued: Chalk.blue,
                available: Chalk.green,
                failed: Chalk.red,
            };
            const moduleState = {};
            let availableCount = 0;
            let polls = 0;

            if (!total) {
                return {};
            }

            console.log(Chalk.bold(`Provisioning ${total} ${pluralization}:`));

            const available$ = awaitAvailable(profile, modules, { onPoll });

            return available$
                .then(() => modules);


            function onPoll(modules) {
                const countByState = _.countBy(modules, mod => mod.state);
                const available = countByState.available || 0;

                if (polls === 0 && countByState.queued && !countByState.failed) {
                    const pluralization = countByState.queued === 1 ? 'module' : 'modules';
                    const verb = countByState.queued === 1 ? 'is' : 'are';

                    console.log(wrapHint(Chalk.italic(`* Hint: ${countByState.queued} ${pluralization} ${verb} queued. Please be patient while we build missing modules. This could take a couple minutes and will only ever need to be done once per module version.`)));
                    console.log();
                }

                _.forEach(modules, mod => {
                    const modId = `${mod.name}@${mod.version}`;

                    if (mod.state !== 'queued' && mod.state !== moduleState[modId]) {
                        const color = stateToColor[mod.state];
                        const update = `  ${modId}: ${color(mod.state)}`;

                        Readline.clearLine(process.stdout);
                        Readline.cursorTo(process.stdout, 0);
                        console.log(update);
                        process.stdout.write(progress.lastDraw);
                    }

                    moduleState[modId] = mod.state;
                });

                progress.tick(available - availableCount);

                availableCount = available;
                polls++;
            }
        });
}
