'use strict';

const Bluebird = require('bluebird');
const Bundler = require('webtask-bundle');
const Cli = require('structured-cli');
const Concat = require('concat-stream');
const Errors = require('./errors');
const Fs = Bluebird.promisifyAll(require('fs'));
const Modules = require('./modules');
const Sandbox = require('sandboxjs');
const Superagent = require('superagent');
const Watcher = require('filewatcher');
const _ = require('lodash');

module.exports = createWebtaskCreator;


function createWebtaskCreator(args, options) {
    options = _.defaultsDeep({}, options, {
        onError: _.noop,
        onGeneration: _.noop,
        logger: {
            info: _.noop,
            warn: _.noop,
            error: _.noop,
        },
    });

    const logger = options.logger;

    return createWebtask;


    function checkNodeModules(profile) {
        if (args.dependencies.length || (args.virtualDependencies && !args.packageJsonPath)) {
            const modules = args.dependencies.map(spec => Modules.parseSpec(spec));

            if (args.virtualDependencies) {
                for (let name in args.virtualDependencies) {
                    const range = args.virtualDependencies[name];

                    modules.push({ name, range });
                }
            }

            return Modules.provision(profile, modules, { logger })
                .tap(dependencies => {
                    const resolved = dependencies.reduce((resolved, dependency) => {
                        resolved[dependency.name] = dependency.version;
                        return resolved;
                    }, {});

                    args.resolvedDependencies = resolved;
                    args.meta['wt-node-dependencies'] = JSON.stringify(resolved);
                }, (error) => {
                    throw new Cli.error.serverError(`Failed to provision node modules: ${ error.message }`);
                });
        } else if (args.packageJsonPath && !args.ignorePackageJson) {
            return Fs.readFileAsync(args.packageJsonPath)
                .then(packageJsonBuffer => {
                    let packageJson;
                    try {
                        packageJson = JSON.parse(packageJsonBuffer.toString('utf8'));
                    } catch (e) {
                        throw new Cli.error.badRequest('A package.json file was detected but could not be parsed as valid json');
                    }
                    const dependencies = Object.assign(args.virtualDependencies || {}, packageJson.dependencies);
                    const modules = _.map(dependencies, (range, name) => ({ name, range }));

                    return Modules.provision(profile, modules, { logger })
                        .tap(dependencies => {
                            const resolved = dependencies.reduce((resolved, dependency) => {
                                resolved[dependency.name] = dependency.version;
                                return resolved;
                            }, {});

                            args.resolvedDependencies = resolved;
                            args.meta['wt-node-dependencies'] = JSON.stringify(resolved);
                        }, (error) => {
                            throw new Cli.error.serverError(`Failed to provision node modules: ${ error.message }`);
                        });
                });
        }

        return Promise.resolve([]);
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
            ?   checkNodeModules(profile)
                    .then(() => createBundledWebtask(profile))
            :   createSimpleFileWebtask(profile);
    }

    function createBundledWebtask(profile) {
        let lastGeneration;

        return Bundler.bundle({
            dependencies: args.resolvedDependencies || {},
            entry: args.spec,
            minify: args.minify,
            name: args.name,
            watch: args.watch,
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

            if (args.packageJsonPath) {
                watcher.add(args.packageJsonPath);
            }

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
