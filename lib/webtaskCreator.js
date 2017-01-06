var Bluebird = require('bluebird');
var Bundler = require('webtask-bundle');
var Cli = require('structured-cli');
var Chalk = require('chalk');
var Concat = require('concat-stream');
var Fs = Bluebird.promisifyAll(require('fs'));
var Modules = require('./modules');
var Sandbox = require('sandboxjs');
var Superagent = require('superagent');
var Watcher = require('filewatcher');
var Errors = require('./errors')
var _ = require('lodash');


const ENSURE_AVAILABLE_TIMEOUT = 1000 * 60 * 5;

module.exports = createWebtaskCreator;


function createWebtaskCreator(args, options) {
    options = _.defaults({}, options, {
        onError: _.noop,
        onGeneration: _.noop,
    });

    return createWebtask;


    function checkNodeModules(profile) {
        if (args.packageJsonPath) {
            return Fs.readFileAsync(args.packageJsonPath)
                .then(packageJsonBuffer => {
                    const packageJson = JSON.parse(packageJsonBuffer.toString('utf8'));
                    const modules = _.map(packageJson.dependencies, (range, name) => ({ name, range }));

                    return Bluebird.map(modules, Modules.resolveSpec)
                        .then(modules => awaitNodeModules(profile, modules))
                        // Set a cap to the waiting period 
                        .timeout(ENSURE_AVAILABLE_TIMEOUT);
                }, _.constant(null));
        }
    }

    function awaitNodeModules(profile, modules) {
        return checkAvailability(modules);


        function checkAvailability(modules) {
            return Modules.ensure(profile, modules)
                .then(validateAvailability);
        }

        function validateAvailability(results) {
            const failed = _.find(results, module => module.state === 'failed');

            if (failed) {
                return Bluebird.reject(Cli.errors.serverError(`Webtask creation aborted because the module ${failed.name}@${failed.version} failed to build.`));
            }

            const queued = _.find(results, module => module.state === 'failed');

            if (queued) {
                return Bluebird.delay(1000 * 5, results)
                    .then(checkAvailability);
            }

            // All modules are available, let's add them to the metadata
            const dependencies = _(modules).keyBy('name').mapValues('version').value();

            args.meta['wt-node-dependencies'] = JSON.stringify(dependencies);
        }
    }

    function createWebtask(profile) {
        return args.source === 'url'
            ?   createSimpleWebtask(profile)
            :   createLocalWebtask(profile);
    }

    function createSimpleWebtask(profile, generation) {
        var codeOrUrl$ = args.capture
            ?   Sandbox.issueRequest(Superagent.get(args.spec)).get('text')
            :   args.source === 'stdin'
                ?   readStdin()
                :   args.source === 'file'
                    ?   Fs.readFileAsync(args.spec, 'utf8')
                    :   Bluebird.resolve(args.spec);

        var webtask$ = codeOrUrl$
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

                var concat = Concat({ encoding: 'string' }, resolve);

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
        var lastGeneration;

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

            var webtask$ = profile.create(build.code, {
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

            var watcher = Watcher();
            var queue = Bluebird.resolve();
            var generation = 0;

            watcher.add(args.spec);

            watcher.on('change', onChange);
            watcher.on('error', onError);

            onChange();

            function onChange() {
                queue = queue.then(function () {
                    var webtask$ = createSimpleWebtask(profile, ++generation);

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
