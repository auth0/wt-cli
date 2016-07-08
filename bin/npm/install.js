var Chalk = require('chalk');
var Bluebird = require('bluebird');
var Cli = require('structured-cli');
var Semver = require('semver');
var Superagent = require('superagent');
var Request = require('sandboxjs/lib/issueRequest');
var npmRunner = require('../../lib/npmRunner');

module.exports = Cli.createCommand('install', {
    description: 'Installs a package',
    handler: handleInstall,
    options: {
      // provided as convienience
      save: {
        action: 'storeTrue'
      }
    },
    params: {
      varargs: {
          description: 'Libraries to install',
          type: 'string',
          required: true,
          nargs: '*'
      }
    }
});

function getAvailableModules () {
  var LIST_MODULES_URL = 'https://webtask.it.auth0.com/api/run/wt-tehsis-gmail_com-1?key=eyJhbGciOiJIUzI1NiIsImtpZCI6IjIifQ.eyJqdGkiOiJmZGZiOWU2MjQ0YjQ0YWYyYjc2YzAwNGU1NjgwOGIxNCIsImlhdCI6MTQzMDMyNjc4MiwiY2EiOlsiZDQ3ZDNiMzRkMmI3NGEwZDljYzgwOTg3OGQ3MWQ4Y2QiXSwiZGQiOjAsInVybCI6Imh0dHA6Ly90ZWhzaXMuZ2l0aHViLmlvL3dlYnRhc2tpby1jYW5pcmVxdWlyZS90YXNrcy9saXN0X21vZHVsZXMuanMiLCJ0ZW4iOiIvXnd0LXRlaHNpcy1nbWFpbF9jb20tWzAtMV0kLyJ9.MJqAB9mgs57tQTWtRuZRj6NCbzXxZcXCASYGISk3Q6c';
  var request = Superagent.get(LIST_MODULES_URL);
  return Request(request)
          .get('body')
          .then(function (body) {
            return body.modules;
          });
}


// Command handler
function handleInstall (args) {
  var requestedLibs = args.varargs.filter(isNotOption).map(toLibObject);
  var passThroughArgs = args.varargs.filter(isOption);

  if (args.save) {
    passThroughArgs.unshift('--save');
  }

  return getAvailableModules().then(function (libraries) {
      var unresolvedLibs = [];
      var resolvedLibs = requestedLibs.map(function (lib) {
        var remoteLibs = findLibByName(libraries, lib.name);
        var availableVers = remoteLibs.map(getVersion);
        var errorMessage = lib.original + ' is not available.';
        if (availableVers.length) {
          var resolvedVersion = Semver.maxSatisfying(availableVers, lib.version);
          if (resolvedVersion) {
            resolvedLib = lib.name + '@' + resolvedVersion;
            return resolvedLib;
          }

          errorMessage = 'No compatible version found for ' + lib.original + '\n';
          errorMessage += 'Available versions are: ';
          errorMessage += availableVers.join(', ');
        }

        throw Cli.error.notFound(errorMessage);
      });

      if (resolvedLibs.length) {
        console.log(Chalk.green(
          'Installing ' + resolvedLibs.join(', ') + '\n' +
          'Running npm install\n'
        ));
        return npmRunner('install', resolvedLibs.concat(passThroughArgs));
      }

    }, modulesFailed);

}

function modulesFailed () {
  throw Cli.error.serverError('Library not available on webtask');
}

// converts lib@x.x.x to an object {library: library, version: version}
function toLibObject (libraryStr) {
  var parts = libraryStr.split('@');
  return {
    original: libraryStr,
    version: parts[1] || '*',
    name: parts[0]
  }
}

// Helpers to find library in webtask
function findLibByName (libraries, name) {
  return libraries.filter(function(el){
    return el.name === name;
  }).reverse();
}

function getVersion (lib) {
  return lib.version;
}

function isOption (arg) {
  return arg.indexOf('--') === 0;
}

function isNotOption (arg) {
  return arg.indexOf('--') === -1;
}
