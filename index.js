var Boom = require('boom');
var Bluebird = require('bluebird');
var Fs = require('fs');
var Jws = require('jws');
var Path = require('path');
var Through = require('through2');
var Url = require('url');
var Wreck = require('wreck');
var _ = require('lodash');


var smsEmailToken = 'eyJhbGciOiJIUzI1NiIsImtpZCI6IjIifQ.eyJqdGkiOiIyOTY5N2Y2MzM2ZTI0MWFjYTIxNjc1ZmE4ZWNmMjQ0MSIsImlhdCI6MTQzMzU0NzU2NCwiZHIiOjEsImNhIjpbXSwiZGQiOjAsInVybCI6Imh0dHBzOi8vY2RuLmF1dGgwLmNvbS93ZWJ0YXNrcy9zbXNfdmVyaWZpY2F0aW9uLmpzIiwidGVuIjoiYXV0aDAtd2VidGFzay1jbGkiLCJlY3R4IjoiK3BXR2MweFluUzV3V0laVlZOVjB5MmsyYitFY1MvbC9nTmwrc21ERkR6anFtdEp3RGl1a1JPMzcwVjZOUTJIZlc0am90YTQ0SXdDUE9iYUxneGhJc3pvWEVqdVAza1ZHWmUxZWF4T3BhdjFRelUzSTJRdlk2a1ZVVXM4YkhJMUtMcm52VjNEVjVRb1pJOEoxREErM2tuUDNXc3V4NnlydENPcXlrMUhpVGdFbS83Q1JSUFBmUzVuZTJEMTBKbnlaT2loMis1RTkzeVdidm5LM3F1aHF5VUl6QWlsQW1iSGNLRmpUMjB5OGF0MG03MXBzbm5teXN5K2I4MzJFN2F6aTBNbndTMUZ2UlRaWnNrUVdQdmlrWmpDRWE1bHhKUTBvanNHdklzMmVYRXhYNmxBUFBvTUVWd3k2T1pxYjA2Mzc2Njh4bHczQmRkUm9IUzF5UzZTVGNYcUY1YW42aDhkempxb29OWEF0aFFKeE5wQjN1c0VNcHdZOWxzSmxBNHpTLnhNaitWUGxkYUd5ZHhlcXRNYkJEK0E9PSJ9.cOcejs_Wj4XxpeR8WGxoSpQvec8NhfsScfirFPkATrg';


var limits = {
    container: {
        second: 'ls',
        minute: 'lm',
        hour: 'lh',
        day: 'ld',
        week: 'lw',
        month: 'lo'
    },
    token: {
        second: 'lts',
        minute: 'ltm',
        hour: 'lth',
        day: 'ltd',
        week: 'ltw',
        month: 'lto',
    },
};

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
                throw new Boom.notFound('Profile `' + profileName
                    + '` not found.');
            
            return new WebtaskProfile(profile);
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
                throw Boom.notFound('No such profile `' + profileName + '`');
                
            delete profiles[profileName];
        });
    
    return cb ? promise.nodeify(cb) : promise;
};

ConfigFile.prototype.removeAllProfiles = function (cb) {
    this.profiles = {};
    
    var promise = this.save();
    
    return cb ? promise.nodeify(cb) : promise;
};


function WebtaskProfile (options) {
    this.url = options.url;
    this.container = options.container;
    this.token = options.token;

    this.hasCreated = options.hasCreated;
    
    Object.defineProperty(this, '_wreck', {
        value: Wreck.defaults({
            baseUrl: this.url,
            headers: {
                'Authorization': 'Bearer ' + this.token,
            },
            json: true,
        })
    });
}

WebtaskProfile.prototype.createToken = Bluebird.method(function (options, cb) {
    var params = {
        ten: options.container || this.container,
        dd: options.issuanceDepth || 0,
    };

    if (options.exp !== undefined && options.nbf !== undefined
        && options.exp <= options.nbf) {
        return Bluebird.reject('The `nbf` parameter cannot be set to a later time than `exp`.');
    }

    if (options.code_url)
        params.url = options.code_url;
    if (options.code) 
        params.code = options.code;
    if (options.secret && Object.keys(options.secret).length > 0)
        params.ectx = options.secret;
    if (options.param && Object.keys(options.param).length > 0)
        params.pctx = options.param;
    if (options.nbf !== undefined)
        params.nbf = options.nbf;
    if (options.exp !== undefined)
        params.exp = options.exp;
    if (options.merge)
        params.mb = 1;
    if (options.parse)
        params.pb = 1;
    if (!options.selfRevoke)
        params.dr = 1;
    if (options.name)
        params.jtn = options.name;
    
    if (options.tokenLimit)
        addLimits(options.tokenLimit, limits.token);
    if (options.containerLimit)
        addLimits(options.containerLimit, limits.container);
        
    console.log('params', params);
    
    var promise = request(this._wreck, 'post', '/api/tokens/issue', {}, params)
        .spread(function (res, token) {
            return token.toString('utf8');
        });
    
    if (cb) return promise.nodify(cb);
    else return promise;

    function addLimits(limits, spec) {
        for (var l in limits) {
            var limit = parseInt(limits[l], 10);
            
            if (!spec[l]) {
                throw new Error('Unsupported limit type `' + l
                    + '`. Supported limits are: '
                    + Object.keys(spec).join(', ') + '.');
            }
            
            if (isNaN(limits[l]) || Math.floor(+limits[l]) !== limit
                || limit < 1) {
                    throw new Error('Unsupported limit value for `' + l
                        + '` limit. All limits must be positive integers.');
            }
            
            params[spec[l]] = limit;
        }
    }
});

WebtaskProfile.prototype.createLogStream = function (options, cb) {
    var self = this;
    
    var promise = new Bluebird(function (resolve, reject) {
        var url = '/api/logs/tenant/' + (options.container || self.container);
        var reqOptions = { 
            headers: { 'accept': 'text/event-stream' },
        };
        
        self._wreck.request('get', url, reqOptions, function (err, res) {
            if (err) return reject(err.isBoom ? err : Boom.wrap(err, 502,
                'Error communicating with webtask cluster: ' + err.message));
            
            if (res.statusCode >= 400) {
                // Error response from webtask cluster
                return reject(Boom.create(res.statusCode,
                    'Error returned by webtask cluster: ' + res.statusCode));
            } else if (res.statusCode >= 300) {
                // Unresolved redirect from webtask cluster
                return reject(Boom.create(502,
                    'Unexpected response-type from webtask cluster: '
                    + err.message));
            }
            
            var lastId = '';
            var eventName = '';
            var eventData = '';
            var eventBuffer = '';
            
            // Accumulate data until the end of a block (two newlines)
            var logMapper = Through(function (chunk, enc, callback) {
                var data = chunk.toString('utf8');
                var events = data.split('\n\n');
                
                _.forEach(events, function (event) {
                    if (!event) {
                        this.push(eventBuffer);
                        eventBuffer = '';
                    } else {
                        eventBuffer += event;
                    }
                }, this);
                
                callback();
            });
            
            // Parse blocks and emit json objects
            var logParser = Through.obj(function (chunk, enc, callback) {
                // For parsing this, see: http://www.w3.org/TR/2009/WD-eventsource-20091029/#event-stream-interpretation
                var event = chunk.toString('utf8');
                var lines = event.split('\n');
                
                _.forEach(lines, function (line) {
                    var matches = line.match(/^([^:]*):(.*)$/);
                    
                    if (matches) {
                        var field = matches[1];
                        var value = matches[2];
                        
                        if (!field) return; // event-source comment
                        if (field === 'event') eventName = value;
                        else if (field === 'data') eventData += value;
                        else if (field === 'id') lastId = value;
                    } else {
                        // console.log('unexpected data', line);
                    }
                }, this);
                
                var eventObj = {
                    id: lastId,
                    type: eventName || 'data',
                    data: eventData,
                };
                
                lastId = '';
                eventName = '';
                eventData = '';
                
                this.push(eventObj);
                
                callback();
            });
            
            var logStream = res
                .pipe(logMapper)
                .pipe(logParser);
            
            resolve(logStream);
        });
    });
    
    return cb ? promise.nodify(cb) : promise;
};

WebtaskProfile.prototype.createCronJob = function (options, cb) {
    var url = '/api/cron/' + options.container + '/' + options.name;
    var promise = request(this._wreck, 'put', url, {}, {
        token: options.token,
        schedule: options.schedule,
    })
        .get(1); // Return the job
    
    return cb ? promise.nodeify(cb) : promise;
};

WebtaskProfile.prototype.removeCronJob = function (options, cb) {
    var url = '/api/cron/' + options.container + '/' + options.name;
    var promise = request(this._wreck, 'delete', url)
        .get(1); // Return the job
    
    return cb ? promise.nodeify(cb) : promise;
};

WebtaskProfile.prototype.listCronJobs = function (options, cb) {
    var url = '/api/cron/' + options.container;
    var promise = request(this._wreck, 'get', url)
        .get(1); // Return the job array
    
    return cb ? promise.nodeify(cb) : promise;
};

WebtaskProfile.prototype.getCronJob = function (options, cb) {
    var url = '/api/cron/' + options.container + '/' + options.name;
    var promise = request(this._wreck, 'get', url)
        .get(1); // Return the job
    
    return cb ? promise.nodeify(cb) : promise;
};

WebtaskProfile.prototype.getCronJobHistory = function (options, cb) {
    var url = '/api/cron/' + options.container + '/' + options.name + '/history';
    var query = {};
    
    if (options.offset) query.offset = options.offset;
    if (options.limit) query.limit = options.limit;
    
    var promise = request(this._wreck, 'get', url, query)
        .get(1); // Return the job history
    
    return cb ? promise.nodeify(cb) : promise;
};

function request (wreck, method, path, query, payload, options) {
    if (!options) options = {};
    
    _.defaultsDeep(options, {
        headers: {},
    });
    
    var url = Url.parse(path, true);
    _.extend(url.query, query);
    delete url.search;
    path = Url.format(url);
    
    if (payload) {
        options.payload = payload;
        
        // Not supporting streams for now
        if (!_.isString(payload) && !Buffer.isBuffer(payload)) {
            options.payload = JSON.stringify(payload);
            options.headers['content-type'] = 'application/json';
        }
    }
    
    if (!wreck) throw new Boom.badImplementation('Missing wreck instance.');
    if (!wreck[method])
        throw new Boom.badImplementation('Invalid request method: ' + method);
    
    return new Bluebird(function (resolve, reject) {
        wreck[method](path, options, function (err, res, body) {
            if (err) return reject(err.isBoom ? err : Boom.wrap(err, 502,
                'Error communicating with webtask cluster: ' + err.message));
            
            if (res.statusCode >= 400) {
                // Error response from webtask cluster
                return reject(Boom.create(res.statusCode,
                    'Error returned by webtask cluster: ' + JSON.stringify(body, null, 2)),
                    Buffer.isBuffer(body) ? body.toString() : body);
            } else if (res.statusCode >= 300) {
                // Unresolved redirect from webtask cluster
                return reject(Boom.create(502,
                    'Unexpected response-type from webtask cluster: '
                    + err.message));
            }

            resolve([res, body]);
        });
    });
}

function createToken (options, cb) {
    var config = new ConfigFile();
    var promise = config.getProfile(options.profile)
        .then(function (profile) {
            return profile.createToken(options);
        });
    
    return cb ? promise.nodeify(cb) : promise;
}

function UserVerifier (config) {
    if (!config) config = {};
    
    this.token = config.token || smsEmailToken;
    this.sandboxUrl = config.sandboxUrl || 'https://webtask.it.auth0.com';
    
    Object.defineProperty(this, '_wreck', {
        value: Wreck.defaults({
            baseUrl: this.sandboxUrl,
            headers: {
                'Authorization': 'Bearer ' + this.token,
            },
            json: true,
        })
    });
}

UserVerifier.prototype._runVerifierWebtask = function (query) {
    var url = '/api/run/auth0-webtask-cli';
    
    return request(this._wreck, 'get', url, query);
};

UserVerifier.prototype.requestVerificationCode = Bluebird.method(function (phoneOrEmail, cb) {
    var self = this;
    var type;
    var value;
    
    if (UserVerifier.isPhone(phoneOrEmail)) {
        if (phoneOrEmail.indexOf('+') !== 0)
            phoneOrEmail = '+1' + phoneOrEmail; // default to US     
        type = 'phone';
        value = phoneOrEmail;
    } else if (UserVerifier.isEmail(phoneOrEmail)) {
        type = 'email';
        value = phoneOrEmail;
    } else {
        throw new Boom.badRequest('You must specify a valid e-mail address '
            + 'or a phone number. The phone number must start with + followed '
            + 'by country code, area code, and local number.');
    }
    
    var payload = {};
    
    payload[type] = value;
    
    var promise = this._runVerifierWebtask(payload)
        .spread(function (res, body) {
            // Return a function that can be called to verify the identification
            // code.
            return function verify (code, cb) {
                var payload = { verification_code: code };
                payload[type] = value;
                
                var promise = self._runVerifierWebtask(payload)
                    .get(1) // Get the body, 2nd argument
                    .get('id_token')
                    .then(Jws.decode)
                    .get('payload') // Traverse into decoded jwt
                    .get('webtask'); // To get the webtask info
                    
                return cb ? promise.nodeify(cb) : promise;
            };
        });
    
    return cb ? promise.nodeify(cb) : promise;
});

UserVerifier.isPhone = function (value) {
    return !!value.match(/^\+?[0-9]{1,15}$/);
};
    
UserVerifier.isEmail = function (value) {
    return !!value.match(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i);
};


function configFile (configPath) {
    return new ConfigFile(configPath);
}

function withProfile (profileName) {
    var config = new ConfigFile();
    
    return config.getProfile(profileName);
}

function createUserVerifier (config) {
    return new UserVerifier(config);
}


exports.configFile = configFile;
exports.withProfile = withProfile;
exports.createToken = createToken;
exports.createUserVerifier = createUserVerifier;
