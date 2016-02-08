var Bluebird = require('bluebird');
var Errors = require('./errors');
var Fs = require('fs');
var Path = require('path');
var Sandbox = require('sandboxjs');


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
    
    this.loaded = readFile(this.configPath, 'utf8')
        .catch(function (e) {
            if (e.code === 'ENOENT') return '{}';
            else throw e;
        })
        .then(JSON.parse)
        .then(function (profiles) {
            return (self.profiles = profiles);
        });
    
    return cb ? this.loaded.nodeify(cb) : this.loaded;
};

ConfigFile.prototype.save = function (cb) {
    var writeFile = Bluebird.promisify(Fs.writeFile, Fs);
    var profileData = JSON.stringify(this.profiles, null, 2);
    
    var promise = writeFile(this.configPath, profileData, 'utf8');
    
    return cb ? promise.nodeify(cb) : promise;
};

ConfigFile.prototype.getProfile = function (profileName, cb) {
    if (!profileName) profileName = 'default';
    
    var promise = this.load()
        .get(profileName)
        .then(function (profile) {
            if (!profile) 
                throw new Errors.notFound('Profile `' + profileName
                    + '` not found.');
            
            return Sandbox.init(profile);
        });
    
    return cb ? promise.nodeify(cb) : promise;
};

ConfigFile.prototype.setProfile = function (profileName, profileData, cb) {
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
                throw Errors.notFound('No such profile `' + profileName + '`');
                
            delete profiles[profileName];
        });
    
    return cb ? promise.nodeify(cb) : promise;
};

ConfigFile.prototype.removeAllProfiles = function (cb) {
    this.profiles = {};
    
    var promise = this.save();
    
    return cb ? promise.nodeify(cb) : promise;
};
