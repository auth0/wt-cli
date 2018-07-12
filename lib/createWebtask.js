'use strict';

const Chalk = require('chalk');
const Logs = require('../lib/logs');
const WebtaskCreator = require('../lib/webtaskCreator');

module.exports = createWebtask;

function createWebtask(args, options) {
    if (!options) options = {};
    if (!options.action) options.action = 'created';

    const profile = args.profile;
    const logger = args.watch ? Logs.createLogStream(profile) : {
        info: function info() { return console.log.apply(console, Array.prototype.slice.call(arguments)); }, // eslint-disable-line no-console
        warn: function warn() { return console.log.apply(console, Array.prototype.slice.call(arguments)); }, // eslint-disable-line no-console
        error: function error() { return console.log.apply(console, Array.prototype.slice.call(arguments)); }, // eslint-disable-line no-console
    };

    if (args.dependencies.length && args.packageJsonPath) {
        logger.info(
            Chalk.italic(
                `* Hint: Since you have specified dependencies using the ${Chalk.bold('--dependency')} flag, the dependencies from the ${Chalk.bold('package.json')} file adjacent to your webtask file will be ignored.`
            )
        );

        args.packageJsonPath = null;
    }

    if (
        !args.dependencies.length &&
        args.packageJsonPath &&
        !args.ignorePackageJson
    ) {
        logger.info(
            Chalk.italic(
                `* Hint: A ${Chalk.bold('package.json')} file has been detected adjacent to your webtask. Ensuring that all ${Chalk.bold('dependencies')} from that file are available on the platform. This may take a few minutes for new versions of modules so please be patient.`
            )
        );
        logger.info(
            Chalk.italic(
                `* Hint: If you would like to opt-out from this behaviour, pass in the ${Chalk.bold('--ignore-package-json')} flag.`
            )
        );
    }

    const createWebtask = WebtaskCreator(args, {
        logger,
        onGeneration: onGeneration,
        onError: onError,
    });

    return createWebtask(profile);

    function onError(build) {
        formatError(build);
    }

    function onGeneration(build) {
        formatOutput(build, build.webtask.url);
    }

    function formatError(build) {
        if (args.watch) {
            const output = { generation: build.generation };

            if (build.stats.errors.length) {
                logger.error(output, `Bundling failed: ${ build.stats.errors[0] }`);
            }
        } else if (args.output === 'json') {
            const json = {
                name: args.name,
                container: args.profile.container,
                errors: build.stats.errors,
            };

            logger.error(JSON.stringify(json, null, 2));
        } else {
            logger.error(Chalk.red('Bundling failed'));

            if (build.stats.errors.length) {
                logger.error(build.stats.errors[0]);
            }
        }
    }

    function formatOutput(build, url) {
        let output;

        if (args.watch) {
            output = {
                generation: build.generation,
                container: build.webtask.container,
            };

            if (args.showToken) {
                output.token = build.webtask.token;
            }

            logger.info(output, 'Webtask %s: %s', options.action, url);
        } else if (args.output === 'json') {
            output = {
                url: url,
                name: build.webtask.claims.jtn,
                container: build.webtask.container,
            };

            if (args.showToken) {
                output.token = build.webtask.token;
            }

            logger.info(JSON.stringify(output, null, 2));
        } else if (options.onOutput) {
            options.onOutput(logger.info, build, url);
        } else if (args.showToken) {
            logger.info(Chalk.green('Webtask token %s') + '\n\n%s\n\nYou can access your webtask at the following url:\n\n%s', options.action, Chalk.gray(build.webtask.token), Chalk.bold(url));
        } else {
            logger.info(Chalk.green('Webtask %s') + '\n\nYou can access your webtask at the following url:\n\n%s', options.action, Chalk.bold(url));
        }
    }
}
