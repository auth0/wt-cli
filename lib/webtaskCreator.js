'use strict';

const Bluebird = require('bluebird');
const Bundler = require('webtask-bundle');
const Chalk = require('chalk');
const Cli = require('structured-cli');
const Concat = require('concat-stream');
const Errors = require('./errors')
const Fs = Bluebird.promisifyAll(require('fs'));
const Modules = require('./modules');
const Sandbox = require('sandboxjs');
const Superagent = require('superagent');
const Watcher = require('filewatcher');
const Wrap = require('linewrap');
const _ = require('lodash');

const wrapHint = Wrap(process.stdout.columns, {
    skipScheme: 'ansi-color',
    wrapLineIndent: 2,
});

module.exports = createWebtaskCreator;


function createWebtaskCreator(args, options) {
    options = _.defaults({}, options, {
        onError: _.noop,
        onGeneration: _.noop,
    });

    return createWebtask;


    function checkNodeModules(profile) {
        if (args.dependencies.length) {
            if (args.packageJsonPath) {
                console.log(wrapHint(Chalk.italic(`* Hint: Since you have specified dependencies using the ${Chalk.bold('--dependency')} flag, the dependencies from the ${Chalk.bold('package.json')} file adjacent to your webtask file will be ignored.`)));
                console.log();
            }

            const modules = args.dependencies.map(spec => Modules.parseSpec(spec));

            return Modules.provision(profile, modules)
                .tap(dependencies => {
                    const resolved = dependencies.reduce((resolved, dependency) => {
                        resolved[dependency.name] = dependency.version;
                        return resolved;
                    }, {});

                    args.meta['wt-node-dependencies'] = JSON.stringify(resolved);
                });
        } else if (args.packageJsonPath && !args.ignorePackageJson) {
            console.log(wrapHint(Chalk.italic(`* Hint: A ${Chalk.bold('package.json')} file has been detected adjacent to your webtask. Ensuring that all ${Chalk.bold('dependencies')} from that file are avialable on the platform. This may take a few minutes for new versions of modules so please be patient.`)));
            console.log(wrapHint(Chalk.italic(`* Hint: If you would like to opt-out from this behaviour, pass in the ${Chalk.bold('--ignore-package-json')} flag.`)));
            console.log();

            return Fs.readFileAsync(args.packageJsonPath)
                .then(packageJsonBuffer => {
                    const packageJson = JSON.parse(packageJsonBuffer.toString('utf8'));
                    const modules = _.map(packageJson.dependencies, (range, name) => ({ name, range }));

                    return Modules.provision(profile, modules)
                        .tap(dependencies => {
                            const resolved = dependencies.reduce((resolved, dependency) => {
                                resolved[dependency.name] = dependency.version;
                                return resolved;
                            }, {});

                            args.meta['wt-node-dependencies'] = JSON.stringify(resolved);
                        });
                }, _.constant(null));
        }
    }



    function createWebtask(profile) {
        return args.source === 'url'
            ?   createSimpleWebtask(profile)
            :   createLocalWebtask(profile);
    }

    function createSimpleWebtask(profile, generation) {
        const codeOrUrl$ = args.capture
            ?   Sandbox.issueRequest(Superagent.get(args.spec)).get('text')
            :   args.source === 'stdin'
                ?   readStdin()
                :   args.source === 'file'
                    ?   Fs.readFileAsync(args.spec, 'utf8')
                    :   Bluebird.resolve(args.spec);

        const webtask$ = codeOrUrl$
            .tap(() => checkNodeModules(profile))
            .then(function (codeOrUrl) {
                return profile.create(codeOrUrl, {
                    name: args.name,
                    merge: args.merge,
                    parse: (args.parseBody || args.parse) !== undefined ? +(args.parseBody || args.parse) : undefined,
                    secrets: args.secrets,
                    params: args.params,
                    meta: args.meta,
                    host: args.host
                });
            })
            .catch(function (e) {
                return e && e.statusCode === 403;
            }, function (e) {
                throw Errors.notAuthorized('Error creating webtask: ' + e.message);
            });

        return webtask$
            .tap(function (webtask) {
                return options.onGeneration({
                    generation: +generation,
                    webtask: webtask,
                });
            });


        function readStdin() {
            return new Bluebird(function (resolve, reject) {
                if (process.stdin.isTTY) {
                    return reject(Cli.error.invalid('Code must be piped in when no code or url is specified'));
                }

                const concat = Concat({ encoding: 'string' }, resolve);

                concat.once('error', reject);

                process.stdin.pipe(concat);
            });
        }
    }

    function createLocalWebtask(profile) {
        return args.bundle
            ?   createBundledWebtask(profile)
            :   createSimpleFileWebtask(profile);
    }

    function createBundledWebtask(profile) {
        let lastGeneration;

        return Bundler.bundle({
            entry: args.spec,
            loose: args.loose,
            watch: args.watch,
            minify: args.minify
        })
            .switchMap(onGeneration)
            .toPromise(Bluebird);

        function onGeneration(build) {
            lastGeneration = build.generation;

            if (build.stats.errors.length) {
                options.onError(build);

                return Bluebird.resolve();
            }

            const webtask$ = profile.create(build.code, {
                name: args.name,
                merge: args.merge,
                parse: (args.parseBody || args.parse) !== undefined ? +(args.parseBody || args.parse) : undefined,
                secrets: args.secrets,
                params: args.params,
                meta: args.meta,
                host: args.host
            });

            return webtask$
                .then(_.partial(onWebtask, lastGeneration), _.partial(onWebtaskError, lastGeneration));


            function onWebtask(generation, webtask) {
                if (lastGeneration === generation) {
                    return Bluebird.resolve(options.onGeneration({
                        generation: generation,
                        webtask: webtask,
                    }));
                }
            }

            function onWebtaskError(generation, err) {
                if (lastGeneration === generation) {
                    console.log('onWebtaskError', err.stack);
                    throw err;
                }
            }
        }
    }

    function createSimpleFileWebtask(profile) {
        return args.watch
            ?   createWatchedFileWebtask(profile)
            :   createSimpleWebtask(profile);
    }

    function createWatchedFileWebtask(profile) {
        return new Bluebird(function (resolve, reject) {

            const watcher = Watcher();
            let generation = 0;
            let queue = Bluebird.resolve();

            watcher.add(args.spec);

            watcher.on('change', onChange);
            watcher.on('error', onError);

            onChange();

            function onChange() {
                queue = queue.then(function () {
                    const webtask$ = createSimpleWebtask(profile, ++generation);

                    return webtask$
                        .catch(onError);
                });
            }

            function onError(err) {
                watcher.removeAll();

                reject(err);
            }
        });
    }
}
