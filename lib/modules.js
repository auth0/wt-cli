'use strict';

const Bluebird = require('bluebird');
const Child = require('child_process');
const Cli = require('structured-cli');
const Semver = require('semver');


module.exports = {
    ensure,
    parseSpec,
    resolveSpec,
};


function ensure(profile, modules) {
    return profile.ensureModules({ modules });
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