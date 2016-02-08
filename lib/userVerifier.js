var Bluebird = require('bluebird');
var Decode = require('jwt-decode');
var Errors = require('./errors');
var Superagent = require('superagent');


var VERIFIER_TOKEN = 'eyJhbGciOiJIUzI1NiIsImtpZCI6IjIifQ.eyJqdGkiOiIyOTY5N2Y2MzM2ZTI0MWFjYTIxNjc1ZmE4ZWNmMjQ0MSIsImlhdCI6MTQzMzU0NzU2NCwiZHIiOjEsImNhIjpbXSwiZGQiOjAsInVybCI6Imh0dHBzOi8vY2RuLmF1dGgwLmNvbS93ZWJ0YXNrcy9zbXNfdmVyaWZpY2F0aW9uLmpzIiwidGVuIjoiYXV0aDAtd2VidGFzay1jbGkiLCJlY3R4IjoiK3BXR2MweFluUzV3V0laVlZOVjB5MmsyYitFY1MvbC9nTmwrc21ERkR6anFtdEp3RGl1a1JPMzcwVjZOUTJIZlc0am90YTQ0SXdDUE9iYUxneGhJc3pvWEVqdVAza1ZHWmUxZWF4T3BhdjFRelUzSTJRdlk2a1ZVVXM4YkhJMUtMcm52VjNEVjVRb1pJOEoxREErM2tuUDNXc3V4NnlydENPcXlrMUhpVGdFbS83Q1JSUFBmUzVuZTJEMTBKbnlaT2loMis1RTkzeVdidm5LM3F1aHF5VUl6QWlsQW1iSGNLRmpUMjB5OGF0MG03MXBzbm5teXN5K2I4MzJFN2F6aTBNbndTMUZ2UlRaWnNrUVdQdmlrWmpDRWE1bHhKUTBvanNHdklzMmVYRXhYNmxBUFBvTUVWd3k2T1pxYjA2Mzc2Njh4bHczQmRkUm9IUzF5UzZTVGNYcUY1YW42aDhkempxb29OWEF0aFFKeE5wQjN1c0VNcHdZOWxzSmxBNHpTLnhNaitWUGxkYUd5ZHhlcXRNYkJEK0E9PSJ9.cOcejs_Wj4XxpeR8WGxoSpQvec8NhfsScfirFPkATrg';


module.exports = UserVerifier;


function UserVerifier (config) {
    if (!config) config = {};
    
    this.token = config.token || VERIFIER_TOKEN;
    this.sandboxUrl = config.sandboxUrl || 'https://webtask.it.auth0.com';
}

UserVerifier.prototype._runVerifierWebtask = function (query) {
    var path = '/api/run/auth0-webtask-cli';
    
    var request = Superagent
        .get(this.sandboxUrl + path)
        .query(query)
        .set('Authorization', 'Bearer ' + this.token);
    
    return Bluebird.resolve(request)
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
    
    var promise$ = this._runVerifierWebtask(payload)
        .then(function (body) {
            // Return a function that can be called to verify the identification
            // code.
            return function verify (code, cb) {
                var payload = { verification_code: code };
                payload[type] = value;
                
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
    return !!value.match(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i);
};