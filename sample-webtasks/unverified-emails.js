var Bluebird = require('bluebird');
var Boom = require('boom');
var Request = Bluebird.promisifyAll(require('request'));
var _ = require('lodash');


/**
 * Webtask that will query the Auth0 user search api for users who have not yet verified
 * their email address, then trigger a reminder to do so for those users, then email
 * the administrator a list of users so-notified.
 * 
 * @param {string} AUTH0_TENANT - The Auth0 tenant for which you would like to run the job.
 * @param {secret} AUTH0_JWT - An Auth0 jwt obtained on https://auth0.com/docs/api/v2 after adding the read:users and update:users scopes.
 */
module.exports = function (context, cb) {
    return Bluebird.try(createScopedRequest, [context])
        .then(function (request) {
            return Bluebird
                .bind({scopedRequest: request})
                .then(getUsersWithUnconfirmedEmails)
                .map(sendVerificationEmail)
                .then(_)
                .call('pluck', 'email');
        })
        .nodeify(cb);
};

function createScopedRequest (context) {
    var tenant = context.data.AUTH0_TENANT;
    var jwt = context.data.AUTH0_JWT;

    if (!tenant) throw Boom.preconditionFailed('Missing parameter AUTH0_TENANT');
    if (!jwt) throw Boom.preconditionFailed('Missing secret AUTH0_JWT');
    
    return Bluebird.promisifyAll(Request.defaults({
        baseUrl: 'https://' + tenant + '.auth0.com/api/v2/',
        headers: {
            'Authorization': 'Bearer ' + jwt,
        },
        json: true,
    }));
}


function getUsersWithUnconfirmedEmails () {
    return this.scopedRequest.getAsync('/users', {
        qs: {
            q: 'email_verified:false',
            search_engine: 'v2',
        },
    })
        .spread(checkResponse);
}

function sendVerificationEmail (user) {
    return this.scopedRequest.postAsync('/jobs/verification-email', {
        json: {
            user_id: user.user_id
        },
    })
        .spread(checkResponse)
        .return(user);
}

function checkResponse (res, body) {
    if (res.statusCode >= 300) {
        console.log('Unexpected response from url `' + res.url + '`:', body);
        
        throw new Boom((body && body.message) || 'Unexpected response from the server', {statusCode: res.statusCode, data: body});
    }
    
    return body;
}