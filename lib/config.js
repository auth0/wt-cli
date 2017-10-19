var Bluebird = require('bluebird');
var Cli = require('structured-cli');
var Fs = Bluebird.promisifyAll(require('fs'));
var Path = require('path');
var Sandbox = require('sandboxjs');
var SuperagentProxy = require('superagent-proxy');
var _ = require('lodash');


module.exports = ConfigFile;


function ConfigFile (configPath) {
    if (!configPath) {
        var homePath = process.env[(process.platform == 'win32')
                ? 'USERPROFILE'
                : 'HOME'
            ];
        configPath = Path.join(homePath, '.webtask');
    }

    this.configPath = configPath;
    this.profiles = {};
    this.loaded = null;
}

ConfigFile.prototype.load = function (cb) {
    var self = this;
    var readFile = Bluebird.promisify(Fs.readFile, Fs);

    if (!this.loaded) {
        this.loaded = readFile(this.configPath, 'utf8')
            .catch(function (e) {
                if (e.code === 'ENOENT') return '{}';
                else throw e;
            })
            .then(JSON.parse)
            .then(function (profiles) {
                self.profiles = _.mapValues(profiles, function (profileData, profileName) {
                    profileData.onBeforeRequest = onBeforeRequest;

                    var profile = Sandbox.init(profileData);

                    profile.name = profileName;
                    profile.openid = profileData.openid;

                    return profile;
                });

                return self.profiles;
            });
    }

    return cb ? this.loaded.nodeify(cb) : this.loaded;
};

ConfigFile.prototype.save = function (cb) {
    var data = _.mapValues(this.profiles, _.partialRight(_.pick, ['url', 'token', 'container', 'openid']));
    var profileData = JSON.stringify(data, null, 2);

    var promise$ = Fs.writeFileAsync(this.configPath, profileData, 'utf8');

    return cb ? promise$.nodeify(cb) : promise$;
};

ConfigFile.prototype.getProfile = function (profileName, cb) {
    var promise = this.load()
        .then(function (profiles) {
            if (!profileName) {
                profileName = Object.keys(profiles).length === 1
                    ?   Object.keys(profiles)[0]
                    :   'default';
            }

            var profile = profiles[profileName];

            if (!profile)
                throw new Cli.error.notFound('Profile `' + profileName
                    + '` not found');

            return profile;
        });

    return cb ? promise.nodeify(cb) : promise;
};

ConfigFile.prototype.setProfile = function (profileName, profileData, cb) {
    if (!profileName) {
        profileName = 'default';
    }

    var promise = this.load()
        .then(function (profiles) {
            return (profiles[profileName] = profileData);
        });

    return cb ? promise.nodeify(cb) : promise;
};

ConfigFile.prototype.removeProfile = function (profileName, cb) {
    var promise = this.load()
        .then(function (profiles) {
            if (!profiles[profileName])
                throw Cli.error.notFound('No such profile `' + profileName + '`');

            delete profiles[profileName];
        });

    return cb ? promise.nodeify(cb) : promise;
};

ConfigFile.prototype.removeAllProfiles = function (cb) {
    this.profiles = {};

    var promise = this.save();

    return cb ? promise.nodeify(cb) : promise;
};


function onBeforeRequest(request) {
    const proxy = process.env.http_proxy || process.env.HTTP_PROXY;
    const result = proxy
        ?   SuperagentProxy(request, proxy)
        :   request;

    return result;
}
