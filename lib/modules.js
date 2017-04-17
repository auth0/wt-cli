'use strict';

const Bluebird = require('bluebird');
const Chalk = require('chalk');
const Cli = require('structured-cli');
const Sandbox = require('sandboxjs');
const Superagent = require('superagent');
const Wrap = require('linewrap');
const _ = require('lodash');

const ENSURE_AVAILABLE_TIMEOUT = 1000 * 60 * 5;
const ENSURE_AVAILABLE_INTERVAL = 1000 * 5;
const UNPKG_URL = 'https://unpkg.com';

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
            return Bluebird.reject(
                Cli.error.timeout(
                    'Timed out waiting for modules to become available'
                )
            );
        }

        return ensure(profile, modules, options).then(validateAvailability);
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
            return Bluebird.reject(
                Cli.error.serverError(
                    `The module ${failed.name}@${failed.version} failed to build.`
                )
            );
        }

        if (queued) {
            return Bluebird.delay(+options.interval).then(checkAvailability);
        }

        return results;
    }
}

function ensure(profile, modules, options) {
    if (!options) {
        options = {};
    }

    return Bluebird.resolve(
        profile.ensureNodeModules({ modules, reset: !!options.reset })
    );
}

function parseSpec(spec) {
    const idx = spec.indexOf('@', 1);
    const name = idx === -1 ? spec : spec.slice(0, idx);
    const range = spec.slice(name.length + 1, spec.length) || '*';

    return { name, range };
}

function resolveSpec(module) {
    const spec = `${ module.name }@${ module.range }`;
    const url = `${ UNPKG_URL }/${ spec }/package.json`;
    const request = Superagent.get(url);

    return Sandbox.issueRequest(request)
        .catch(() => {
            return Bluebird.reject(
                Cli.error.notFound(
                    `Error looking up module on npm that satisfies ${ spec }.`
                )
            );
        })
        .get('body')
        .then(packageJson => {
            return {
                name: module.name,
                version: packageJson.version,
            };
        });
}

function provision(profile, modules, options) {
    options = _.defaultsDeep({}, options, {
        logger: {
            info: _.noop,
            warn: _.noop,
            error: _.noop,
        },
    });

    const logger = options.logger;

    if (modules.length) {
        logger.info(`Resolving ${ Chalk.bold(modules.length) } module${ modules.length === 1 ? '' : 's' }...`);
    }

    return Bluebird.map(modules, resolveSpec).then(modules => {
        const total = Object.keys(modules).length;
        const pluralization = total === 1 ? 'module' : 'modules';
        const stateToColor = {
            queued: Chalk.blue,
            available: Chalk.green,
            failed: Chalk.red,
        };
        const moduleState = {};
        let polls = 0;

        if (!total) {
            return modules;
        }

        logger.info(`Provisioning ${ Chalk.bold(total) } ${ pluralization }...`);

        const available$ = awaitAvailable(profile, modules, { onPoll });

        return available$.then(() => modules);

        function onPoll(modules) {
            const countByState = _.countBy(modules, mod => mod.state);

            if (polls === 0 && countByState.queued && !countByState.failed) {
                const pluralization = countByState.queued === 1
                    ? 'module'
                    : 'modules';
                const verb = countByState.queued === 1 ? 'is' : 'are';

                logger.info(
                    wrapHint(
                        Chalk.italic(
                            `* Hint: ${countByState.queued} ${pluralization} ${verb} queued. Please be patient while we build missing modules. This could take a couple minutes and will only ever need to be done once per module version.`
                        )
                    )
                );
            }

            _.forEach(modules, mod => {
                const modId = `${mod.name}@${mod.version}`;

                if (
                    mod.state !== 'queued' && mod.state !== moduleState[modId]
                ) {
                    const color = stateToColor[mod.state];
                    const update = `${ Chalk.bold(modId) } is ${color(mod.state)}`;

                    logger.info(update);
                }

                moduleState[modId] = mod.state;
            });

            polls++;
        }
    });
}
