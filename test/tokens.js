var Bluebird = require('bluebird');
var Code = require('code');
var Lab = require('lab');
var Mailinator = require('mailinator');
var Webtask = require('../');

var lab = exports.lab = Lab.script();
var expect = Code.expect;

var webtaskProfile = 'wt-dev1';

var mailinatorToken = '1ac756ce9b494f55a5560b77528c198b';
var smsEmailToken = 'eyJhbGciOiJIUzI1NiIsImtpZCI6IjIifQ.eyJqdGkiOiIyOTY5N2Y2MzM2ZTI0MWFjYTIxNjc1ZmE4ZWNmMjQ0MSIsImlhdCI6MTQzMzU0NzU2NCwiZHIiOjEsImNhIjpbXSwiZGQiOjAsInVybCI6Imh0dHBzOi8vY2RuLmF1dGgwLmNvbS93ZWJ0YXNrcy9zbXNfdmVyaWZpY2F0aW9uLmpzIiwidGVuIjoiYXV0aDAtd2VidGFzay1jbGkiLCJlY3R4IjoiK3BXR2MweFluUzV3V0laVlZOVjB5MmsyYitFY1MvbC9nTmwrc21ERkR6anFtdEp3RGl1a1JPMzcwVjZOUTJIZlc0am90YTQ0SXdDUE9iYUxneGhJc3pvWEVqdVAza1ZHWmUxZWF4T3BhdjFRelUzSTJRdlk2a1ZVVXM4YkhJMUtMcm52VjNEVjVRb1pJOEoxREErM2tuUDNXc3V4NnlydENPcXlrMUhpVGdFbS83Q1JSUFBmUzVuZTJEMTBKbnlaT2loMis1RTkzeVdidm5LM3F1aHF5VUl6QWlsQW1iSGNLRmpUMjB5OGF0MG03MXBzbm5teXN5K2I4MzJFN2F6aTBNbndTMUZ2UlRaWnNrUVdQdmlrWmpDRWE1bHhKUTBvanNHdklzMmVYRXhYNmxBUFBvTUVWd3k2T1pxYjA2Mzc2Njh4bHczQmRkUm9IUzF5UzZTVGNYcUY1YW42aDhkempxb29OWEF0aFFKeE5wQjN1c0VNcHdZOWxzSmxBNHpTLnhNaitWUGxkYUd5ZHhlcXRNYkJEK0E9PSJ9.cOcejs_Wj4XxpeR8WGxoSpQvec8NhfsScfirFPkATrg';


lab.experiment('webtask profiles', function () {
    lab.test('can be loaded by name', function (done) {
      
        Webtask.withProfile('wt-dev1')
            .then(function (profile) {
                expect(profile).to.be.an.object();
            })
            .nodeify(done);
    });
  
    lab.test('will trigger an error if they do not exist', function (done) {
        var found;
        var error;
      
        Webtask.withProfile('idonotexist')
            .then(function (profile) {
                found = profile;
            })
            .catch(function (err) {
                error = err;
                expect(err.isBoom).to.be.true();
            })
            .finally(function () {
                expect(found).to.be.undefined();
                expect(error).to.part.include({isBoom: true, output: {statusCode: 404}});
            })
            .nodeify(done);
    });
  
    lab.test('can be used to create a token', function (done) {
        var options = {
            profile: webtaskProfile,
            code_url: 'http://foo'
        };
        
        Webtask.createToken(options)
            .then(function (token) {
                expect(token).to.be.a.string();
                expect(token.split('.')).to.have.length(3);
            })
            .nodeify(done);
    });
  
});


lab.experiment('user verification', { skip: true, timeout: 10 * 1000 }, function () {
    lab.test('will succeed via email', function (done) {
        var verifier = Webtask.createUserVerifier({
            token: smsEmailToken,
            sandboxUrl: 'https://webtask.it.auth0.com',
        });
        
        var emailId = 'verification_' + Date.now();
        var email = emailId + '@mailinator.com';
        
        verifier.requestVerificationCode(email)
            .then(function (verifyFunc) {
                return readToken()
                    .then(verifyFunc);
            })
            .then(function (user) {
                expect(user).to.be.an.object();
                expect(user.token).to.be.a.string();
            })
            .nodeify(done);
            
        
        function readToken () {
            var mailinator = Mailinator({token: mailinatorToken});
            var maxTries = 5;
            var interval = 2000;
            
            return new Bluebird(function (resolve, reject) {
                (function checkMail () {
                    // console.log('checking mail');
                    mailinator.getMessages(emailId, function (err, res) {
                        if (err) return reject(err);
                        
                        // console.log('Got messages', res.length);
                        
                        if (!res.length) return checkAgain();
                        
                        mailinator.readMessage(res[0].id, function (err, res) {
                            if (err) return reject(err);
                            
                            // console.log('Reading message parts',
                            //     res.data.parts.length);
                            
                            for (var i in res.data.parts) {
                                var part = res.data.parts[i];
                                var matches = part.body
                                    .match(/code is:\s+(\d+)/i);
                                    
                                if (matches) return resolve(matches[1]);
                            }
                            
                            return reject(new Error('Unexpected confirmation '
                                + 'email format'));
                        });
                    });
                    
                    function checkAgain () {
                        maxTries--;
                        
                        // console.log('mail not found', maxTries, 'remaining')
                        
                        if (!maxTries) return reject(new Error('Timeout'));
                        
                        setTimeout(checkMail, interval);
                        
                        return;
                    }
                })(); // Immediately invoke checkMail
            });
        }
    });
    
    lab.test('will fail with an invalid phone # or email', function (done) {
        var verifier = Webtask.createUserVerifier({
            token: smsEmailToken,
            sandboxUrl: 'https://webtask.it.auth0.com',
        });
        
        var email = 'no good, johnny';
        var succeeded;
        var failed;
        
        verifier.requestVerificationCode(email)
            .then(function (verifyFunc) { succeeded = verifyFunc; })
            .catch(function (err) { failed = err; })
            .finally(function () {
                expect(succeeded).to.be.undefined();
                expect(failed).to.be.an.object();
                
                done();
            });
    });
  
});