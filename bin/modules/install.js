var Chalk = require('chalk');
var Bluebird = require('bluebird');
var Cli = require('structured-cli');
var Semver = require('semver');
var Superagent = require('superagent');
var Request = require('sandboxjs/lib/issueRequest');
var npmRunner = require('../../lib/npmRunner');
var npa = require('npm-package-arg');
module.exports = Cli.createCommand('install', {
    description: 'Installs one or more npm packages based on versions supported by the platform',
    handler: handleInstall,
    options: {
      // provided as convienience
      save: {
        description: 'Saves the exact version of the package resolved to package.json',
        action: 'storeTrue'
      }
    },
    params: {
      varargs: {
          description: 'Packages to install',
          type: 'string',
          required: true,
          nargs: '*',
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

  requestedLibs.forEach(ensureNpmPackage);

  if (args.save) {
    passThroughArgs.unshift('--save');
    passThroughArgs.unshift('--save-exact');
  }

  return getAvailableModules().then(function (libraries) {
      var unresolvedLibs = [];
      var resolvedLibs = requestedLibs.map(function (lib) {
        var remoteLibs = findLibByName(libraries, lib.name);
        var availableVers = remoteLibs.map(getVersion);
        var errorMessage = lib.raw + ' is not available.';
        if (availableVers.length) {
          var spec = lib.spec === 'latest'? '*' : lib.spec;
          var resolvedVersion = Semver.maxSatisfying(availableVers, spec);
          if (resolvedVersion) {
            resolvedLib = lib.name + '@' + resolvedVersion;
            return resolvedLib;
          }

          errorMessage = 'No compatible version found for ' + lib.raw + '\n';
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
  throw Cli.error.serverError('Failed to load list of avialable packages');
}

// Wrapper to check repository
function ensureNpmPackage (pkg) {
  var unsupportedTypes = ['git', 'hosted', 'local', 'remote'];
  var errorMessage = '';

  if(unsupportedTypes.indexOf(pkg.type) !== -1){
    errorMessage = pkg.raw + ' is a ' + pkg.type + 'package\n';
  }

  if(pkg.scope !== null){
    errorMessage = pkg.raw + ' is a scoped package \n';
  }

  if(errorMessage){
    errorMessage += 'We only support unscoped packages hosted originally on npm.\n';
    errorMessage += 'Please use npm install to install the package instead';
    throw Cli.error.badRequest(errorMessage);
  }
}


// Wrapper to parse npm packages
function toLibObject (rawStr) {
  return npa(rawStr);
}

// Helpers to find library in webtask
function findLibByName (libraries, name) {
  return libraries.filter(function(el){
    return el.name === name;
  });
}

function getVersion (lib) {
  return lib.version;
}

function isOption (arg) {
  return arg.indexOf('-') === 0;
}

function isNotOption (arg) {
  return !isOption(arg);
}
