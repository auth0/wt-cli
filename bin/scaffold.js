var Cli = require('nested-yargs');
var Git = require('nodegit');
var Bluebird = require('bluebird');
var Path = require('path');
var Rimraf = require('rimraf');
var Colors = require('colors');
var WriteFile = Bluebird.promisify(require('fs').writeFile);
var JsdParse = require('comment-parser');
var _ = require('lodash');
var Create = require('./create');

module.exports = Cli.createCommand('scaffold', 'download webtask templates', {
    params: '[webtask] [name]',
    setup: function (yargs) {
        Create.options.setup(yargs);
    },
    options: _.assign({}, Create.options.options, {
        repo: {
            alias: 'r',
            description: 'git repo to use',
            type: 'string',
        },
    }),
    handler: handleScaffold,
});

var DEFAULT_REPO_URL = 'https://github.com/bananaoomarang/wt-cli';
var DEFAULT_REPO_SAMPLE_DIR = 'sample-webtasks/';

function handleScaffold(argv) {
    if(argv.params.webtask)
        argv.params.webtask += /.js$/.test(argv.params.webtask) ? '' : '.js'; 
    else
        return listScaffolds()
            .then(cleanup)
            .catch(catchErr);

    // If there's no slash or repo we assume they want to pull from the samples
    if(!/\//.test(argv.params.webtask) && !argv.repo)
        return getCommit(DEFAULT_REPO_URL, 'master')
            .then(function (commit) {
                return scaffoldFrom(argv, commit, DEFAULT_REPO_SAMPLE_DIR + argv.params.webtask)
                    .catch(function (e) {
                        if(e.message.match('does not exist')) {
                            console.error('Requested webtask %s does not exist.\n'.red, Path.basename(argv.params.webtask));

                            return listScaffolds(commit);
                        }

                        throw e;
                    });
            })
            .then(cleanup)
            .catch(catchErr);

    var ghRepoPath = argv.params.webtask
            .split('/')
            .slice(0, 2)
            .join('/');

    var wtPath = argv.repo ?
        argv.params.webtask :
        argv.params.webtask
            .split('/')
            .slice(2)
            .join('/');

    var url = argv.repo || ('https://github.com/' + ghRepoPath);

    return getCommit(url, 'master')
        .then(function (commit) {
            return scaffoldFrom(argv, commit, wtPath)
        })
        .then(cleanup)
        .catch(catchErr);

    function catchErr(e) {
        if(e.message === '\'.tmp\' exists and is not an empty directory') {
            cleanup();

            return handleScaffold(argv);
        }

        console.error(e);
        cleanup();
    }
}

function listScaffolds(commit) {
    var promise = commit ?
        commit.getTree() :
        getCommit(DEFAULT_REPO_URL, 'master')
            .then(function (commit) {
                return commit.getTree();
            })

    return promise 
        .then(function (tree) {
            return tree.getEntry(DEFAULT_REPO_SAMPLE_DIR);
        })
        .then(function (entry) {
            return entry.getTree();
        })
        .then(function (tree) {
            var entries = tree.entries()
                .filter(function (entry) {
                    return Path.extname(entry.toString()) === '.js';
                });

            var blobs = entries
                .map(function (entry) {
                    return entry.getBlob();
                });

            var names = entries
                .map(function (entry) {
                    return Path.basename(entry.toString(), '.js');
                });

            return Bluebird.all(blobs)
                .map(function (blob, index) {
                    var name = names[index];
                    var jsdoc = JsdParse(blob.toString());

                    return {
                        name: name,
                        description: jsdoc[0] ? jsdoc[0].description : 'no description.'
                    };
                });
        })
        .then(function (scaffolds) {
            console.log('Available webtasks:'.green.bold);

            scaffolds
                .forEach(function (scaffold) {
                    console.log(scaffold.name.bold.white + ':', scaffold.description.grey);
                });
        });
}

function scaffoldFrom(argv, commit, path) {
    var filename = argv.params.name ? (argv.params.name + '.js') : 'webtask.js';

    return commit
        .getEntry(path)
        .then(function (entry) {
            return entry.getBlob();
        })
        .then(function (blob) {
            return WriteFile(filename, blob.toString());
        })
        .then(function () {
            argv.params.file_or_url = filename;
            argv.output = 'none';
            argv.name = argv.params.name || Path.basename(filename, '.js');

            return Create.options.handler(argv);
        })
        .then(function (result) {
            console.log('Scaffold written to '.blue, filename.bold.green);
            console.log('Scaffold deployed to'.blue, result.named_webtask_url.bold.green)
        });
}

function cleanup() {
    Rimraf.sync('.tmp');
}

function getCommit(repo, branch) {
    return Git.Clone(repo, '.tmp')
        .then(function (repo) {
            return repo.getBranchCommit(branch);
        });
}
