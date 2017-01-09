'use strict';

const Bluebird = require('bluebird');
const Child = require('child_process');
const Cli = require('structured-cli');
const Semver = require('semver');
const _ = require('lodash');

const ENSURE_AVAILABLE_TIMEOUT = 1000 * 60 * 5;
const ENSURE_AVAILABLE_INTERVAL = 1000 * 5;


module.exports = {
    awaitAvailable,
    ensure,
    parseSpec,
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

    return checkAvailability(modules);


    function checkAvailability(modules) {
        if (+options.timeout > 0 && Date.now() > start + options.timeout) {
            return Bluebird.reject(Cli.errors.timeout('Timed out waiting for modules to become available'));
        }

        return ensure(profile, modules)
            .then(validateAvailability);
    }

    function validateAvailability(results) {
        const failed = _.find(results, module => module.state === 'failed');

        if (failed) {
            return Bluebird.reject(Cli.errors.serverError(`Webtask creation aborted because the module ${failed.name}@${failed.version} failed to build.`));
        }

        const queued = _.find(results, module => module.state === 'failed');

        if (queued) {
            console.log('Queued', queued);

            return Bluebird.delay(+options.interval, results)
                .then(checkAvailability);
        }

        // All modules are available, let's add them to the metadata
        const dependencies = _(modules).keyBy('name').mapValues('version').value();

        return dependencies;
    }
}

function ensure(profile, modules) {
    return Bluebird.resolve(profile.ensureModules({ modules }));
}

function parseSpec(spec) {
    const idx = spec.indexOf('@', 1);
    const name = idx === -1 ? spec : spec.slice(0, idx);
    const range = spec.slice(name.length, spec.length) || '*';

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
    const version = Semver.maxSatisfying(available, range);

    if (!version) {
        return Bluebird.reject(Cli.error.notFound(`No module version found on npm that satisfies ${name}@${range}.`));
    }

    return { name, version };
}