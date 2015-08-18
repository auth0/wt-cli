var Cli = require('nested-yargs');
var Git = require('nodegit');
var Wreck = require('wreck');
var Bluebird = require('bluebird');
var Path = require('path');
var Rimraf = require('rimraf');
var Colors = require('colors');
var WriteFile = Bluebird.promisify(require('fs').writeFile);
var JsdParse = require('comment-parser');
var _ = require('lodash');
var Create = require('./create');

var ghWreck = Wreck.defaults({
    baseUrl: 'https://api.github.com/',
    headers: {
        'User-Agent': 'wt-cli-scaffold'
    },
    json: true,
});

Bluebird.promisifyAll(ghWreck);

module.exports = Cli.createCommand('scaffold', 'download webtask templates', {
    params: '[webtask] [name]',
    setup: function (yargs) {
        Create.options.setup(yargs);
    },
    options: _.assign({}, Create.options.options, {
        repo: {
            description: 'git repo to use',
            type: 'string',
        },
    }),
    handler: handleScaffold,
});

var DEFAULT_REPO_NAME = 'auth0/wt-cli';
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
        return getHead(DEFAULT_REPO_NAME, 'master')
            .then(getTree)
            .then(getBlob.bind(null, Path.join(DEFAULT_REPO_SAMPLE_DIR, argv.params.webtask)))
            .then(scaffold);

    var wtPath = argv.repo ?
        argv.params.webtask :
        argv.params.webtask
            .split('/')
            .slice(2)
            .join('/');

    if(argv.repo)
        return getCommit(argv.repo, 'master')
            .then(function (commit) {
                return commit
                    .getEntry(wtPath)
                    .then(function (entry) {
                        return entry.getBlob()
                    })
                    .then(function (blob) {
                        return scaffold(blob.toString('utf8'));
                    });
            })
            .then(cleanup)
            .catch(catchErr);

    var ghRepo = argv.params.webtask
            .split('/')
            .slice(0, 2)
            .join('/');

    return getHead(ghRepo, 'master')
        .then(getTree)
        .then(getBlob.bind(null, wtPath))
        .then(scaffold);

    function scaffold(str) {
        var filename = argv.params.name ? (argv.params.name + '.js') : 'webtask.js';

        return WriteFile(filename, str)
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

    function catchErr(e) {
        if(e.message === '\'.tmp\' exists and is not an empty directory') {
            cleanup();

            return handleScaffold(argv);
        }

        console.error(e);
        cleanup();
    }
}

function listScaffolds() {
    return getCommit('https://github.com/' + DEFAULT_REPO_NAME, 'master')
        .then(function (commit) {
            return commit.getTree();
        })
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
            console.log('Available webtasks:\n'.green.bold);

            scaffolds
                .forEach(function (scaffold) {
                    console.log('\t' + scaffold.name.bold.white + ':', scaffold.description.grey);
                });

            console.log('');
        });
}

function cleanup() {
    Rimraf.sync('.tmp');
}

function getHead(reponame, headname) {
    var url = Path.join('repos', reponame, 'git/refs/heads', headname);

    return ghWreck
        .getAsync(url)
        .spread(function (res, body) {
            if(body.object)
                return body.object;

            throw 'Could not get head: ' + body.message;
        });
}

function getTree(commit) {
    return ghWreck
        .getAsync(commit.url)
        .spread(function (res, body) {
            return ghWreck
                .getAsync(body.tree.url + '?recursive=1')
                .spread(function (res, body) {
                    return body.tree;
                });
        });
}

function getBlob(path, tree) {
    var matches = tree
        .filter(function (twig) {
            return twig.path.match(path);
        });

    if(!matches.length)
        throw 'File not found';

    if(matches.length > 1)
        throw 'Attempted to scaffold from directory, please supply path to file';

    return ghWreck
        .getAsync(matches[0].url)
        .spread(function (res, body) {
            return (new Buffer(body.content, 'base64').toString('utf8'));
        });
}

function getCommit(repo, branch) {
    return Git.Clone(repo, '.tmp')
        .then(function (repo) {
            return repo.getBranchCommit(branch);
        });
}
