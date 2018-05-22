var Bluebird = require('bluebird');
var Decode = require('jwt-decode');
var Errors = require('./errors');
var Sandbox = require('sandboxjs');
var Superagent = require('superagent');


var VERIFIER_URL = 'https://auth0-extend.sandbox.auth0-extend.com/webtask-cli-verifier';


module.exports = UserVerifier;


function UserVerifier (options) {
}

UserVerifier.prototype._runVerifierWebtask = function (query) {
    var request = Superagent
        .get(VERIFIER_URL)
        .query(query);
    
    return Sandbox.issueRequest(request)
        .get('body');
};

UserVerifier.prototype.requestVerificationCode = function (phoneOrEmail, cb) {
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
        var error$ = Bluebird.reject(new Errors.invalid('You must specify a valid e-mail address '
            + 'or a phone number. The phone number must start with + followed '
            + 'by country code, area code, and local number.'));
            
        return cb ? error$.nodeify(cb) : error$;
    }
    
    var payload = {};
    
    payload[type] = value;
    
    var self = this;
    var promise$ = this._runVerifierWebtask(payload)
        .then(function (body) {
            // Return a function that can be called to verify the identification
            // code.
            return function verify (code, cb) {
                var payload = { verification_code: code };
                payload[type] = value;
                payload.node = '8';
                var verified$ = self._runVerifierWebtask(payload)
                    .get('id_token')
                    .then(Decode)
                    .get('webtask'); // To get the webtask info
                    
                return cb ? verified$.nodeify(cb) : verified$;
            };
        });
    
    return cb ? promise$.nodeify(cb) : promise$;
};

UserVerifier.isPhone = function (value) {
    return value && !!value.match(/^\+?[0-9]{1,15}$/);
};
    
UserVerifier.isEmail = function (value) {
    return !!value.match(/[^@]+@[^@]+/i);
};
