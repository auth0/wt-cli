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
const SecureWebtask = require('../lib/secureWebtask');

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
        if (args.meta && args.meta['wt-node-dependencies']) {
            try {
                args.syntheticDependencies = Object.assign({}, args.syntheticDependencies, JSON.parse(args.meta['wt-node-dependencies']));
            } catch (error) {
                throw new Cli.error.serverError(`Failed to read wt-node-dependencies: ${ error.message }`);
            }
        }

        if (args.dependencies.length || (args.syntheticDependencies && !args.packageJsonPath)) {
            const modules = args.dependencies.map(spec => Modules.parseSpec(spec));

            if (args.syntheticDependencies) {
                for (let name in args.syntheticDependencies) {
                    const range = args.syntheticDependencies[name];

                    // Explicit dependencies should override synthetic dependencies
                    if (!_.find(modules, mod => mod.name === name && mod.range !== range)) {
                        modules.push({ name, range });
                    }
                }
            }

            return Modules.provision(profile, modules, { logger })
                .tap(dependencies => {
                    if (!dependencies.length) return;

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
                    const dependencies = Object.assign({}, args.syntheticDependencies, packageJson.dependencies);
                    const modules = _.map(dependencies, (range, name) => ({ name, range }));

                    return Modules.provision(profile, modules, { logger })
                        .tap(dependencies => {
                            if (!dependencies.length) return;

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

        return args['auth'] === 'jwt'
            ? SecureWebtask(args, {}).then(() => {
                return args.source === 'url'
                ?   createSimpleWebtask(profile)
                :   createLocalWebtask(profile);
            })
            : args.source === 'url'
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
                return putWebtask(profile, args, codeOrUrl);
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

    function putWebtask(profile, args, codeOrUrl) {
        if (profile.openid) {
            // The POST /api/tokens/issue is not supported with auth v2,
            // use PUT /api/webtask/:tenant/:name instead.
            var payload = {};
            if (args.secrets && Object.keys(args.secrets).length > 0) payload.secrets = args.secrets;
            if (args.meta && Object.keys(args.meta).length > 0) payload.meta = args.meta;
            if (args.host) payload.host = args.host;
            payload[(codeOrUrl.indexOf('http://') === 0 || codeOrUrl.indexOf('https://') === 0) ? 'url' : 'code'] = codeOrUrl;

            return Superagent
                .put(`${profile.url}/api/webtask/${profile.container}/${args.name}`)
                .set('Authorization', `Bearer ${profile.token}`)
                .send(payload)
                .ok(res => res.status === 200)
                .then(res => new Sandbox.Webtask(profile, res.body.token, {
                    name: args.name,
                    meta: res.body.meta,
                    webtask_url: res.body.webtask_url,
                }));
        }
        else {
            return profile.create(codeOrUrl, {
                name: args.name,
                merge: args.merge,
                parse: (args.parseBody || args.parse) !== undefined ? +(args.parseBody || args.parse) : undefined,
                secrets: args.secrets,
                params: args.params,
                meta: args.meta,
                host: args.host
            });
        }
    }

    function checkNodeVersion(profile) {
        return Superagent
            .post(`${profile.url}/api/run/${profile.container}`)
            .set('Authorization', `Bearer ${profile.token}`)
            .send(`module.exports = cb => cb(null, { version: process.version.replace(/^v/,'') });`)
            .ok(res => res.status === 200)
            .then(res => res.body.version);
    }

    function createLocalWebtask(profile) {
        return args.bundle
            ?   checkNodeModules(profile)
                    .then(() => checkNodeVersion(profile))
                    .then(nodeVersion => createBundledWebtask(profile, nodeVersion))
            :   createSimpleFileWebtask(profile);
    }

    function createBundledWebtask(profile, nodeVersion) {
        let lastGeneration;

        return Bundler.bundle({
            dependencies: args.resolvedDependencies || {},
            entry: args.spec,
            minify: args.minify,
            name: args.name,
            nodeVersion,
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

            return putWebtask(profile, args, build.code)
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
