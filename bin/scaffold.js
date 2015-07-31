var Cli       = require('nested-yargs');
var Git       = require('nodegit');
var Bluebird  = require('bluebird');
var Path      = require('path');
var Rimraf    = require('rimraf');
var Colors    = require('colors');
var WriteFile = Bluebird.promisify(require('fs').writeFile);
var ExecFile  = Bluebird.promisify(require('child_process').execFile);
var Webtask   = require('../');

module.exports = Cli.createCommand('scaffold', 'download webtask templates', {
    params: '[webtask]',
    options: {
        profile: {
            alias: 'p',
            description: 'name of the webtask profile to use',
            'default': 'default',
            type: 'string'
        }
    },
    handler: handleScaffold
});

var REPO_URL = 'https://github.com/auth0/wt-cli';
var SAMPLE_DIR = 'sample-webtasks';

function handleScaffold(argv) {
    Git.Clone(REPO_URL, '.tmp')
        .then(function (repo) {
            return repo.getBranchCommit('master');
        })
        .then(function (commit) {
            if(!argv.params.webtask)
                return listScaffolds(commit);

            var path = SAMPLE_DIR +
                '/' +
                argv.params.webtask +
                (argv.params.webtask.match(/.js$/) ? '' : '.js');

            return scaffoldFrom(commit, path);
        })
        .then(cleanup)
        .catch(function (e) {
            console.error(e);
            cleanup();
        });
}

function listScaffolds(commit) {
    console.log('Available webtasks:'.green.bold);

    return commit
      .getTree()
      .then(function (tree) {
          return tree.getEntry(SAMPLE_DIR);
      })
      .then(function (entry) {
          return entry.getTree();
      })
      .then(function (tree) {
          tree.entries()
              .filter(function (entry) {
                  return Path.extname(entry.toString()) === '.js';
              })
              .forEach(function (entry) {
                  var filename = Path.basename(entry.toString(), '.js');
                  console.log(filename.bold);
              });
      });
}

function scaffoldFrom(commit, path) {
    return commit.getEntry(path)
        .then(function (entry) {
            return entry.getBlob();
        })
        .then(function (blob) {
            return WriteFile('./webtask.js', blob.toString())
            .then(function () {
                var create_args = [
                    'create',
                    './webtask.js',
                    '-n',
                    Path.basename(path, '.js')
                ];

                return ExecFile(__dirname + '/wt', create_args)
                    .then(function (output) {
                        return output[0].slice(0, -1);
                    });
            })
        })
        .then(function (url) {
            console.log('Scaffold written to'.blue, 'webtask.js'.bold.green);
            console.log('Scaffold deployed to'.blue, url.bold.green)
        })
        .catch(function (e) {
            if(e.message.match('does not exist')) {
                console.error('Requested webtask %s does not exist.\n'.red, Path.basename(path));

                return listScaffolds(commit);
            }

            throw e;
        });
}

function cleanup() {
    Rimraf.sync('.tmp');
}
