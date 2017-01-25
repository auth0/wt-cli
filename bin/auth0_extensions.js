module.exports = {
    'pre-user-registration': {
        description: 'The pre-user-registration extension allows custom code to prevent creation of an appliction user or to add custom app_metadata or user_metadata to a newly created user.',
        compiler: 'auth0-ext-compilers/pre-user-registration',
        template: f(function () {/*
module.exports = function (user, context, cb) {
  // call the callback with an error to signal failure
  // an object with optional `user.user_metadata` and `user.app_metadata` properties.
  cb(null, { 
    user: {
      user_metadata: { foo: 'bar', baz: 17 },
      app_metadata: { vip: true, brownie_points: 2 }
    }
  });
};
        */})
    },
    'post-user-registration': {
        description: 'The post-user-registration extension allows custom code to implement custom actions in response to creation of a new application user in the database.',
        compiler: 'auth0-ext-compilers/post-user-registration',
        template: f(function () {/*
module.exports = function (user, context, cb) {
  // Send message to Slack etc.
  cb(null, { slack_notified: true });
};        */})
    },
    'client-credentials-exchange': {
        description: 'The client-credentials-exchange extension allows custom code to modify the scopes and add custom claims to the tokens issued from the POST /oauth/token Auth0 API.',
        compiler: 'auth0-ext-compilers/client-credentials-exchange',
        template: f(function () {/*
module.exports = function (client, scope, audience, context, cb) {
  // call the callback with an error to signal authorization failure
  // or with a mapping of claims to values (including scopes).
  cb(null, { claim: 'value' }); // return error or a mapping of access token claims
};
        */})
    },
    'password-exchange': {
        description: 'The password-exchange extension allows custom code to modify the scopes and add custom claims to the tokens issued from the POST /oauth/token Auth0 API using grant_type=password.',
        compiler: 'auth0-ext-compilers/password-exchange',
        template: f(function () {/*
module.exports = function (user, client, scope, audience, context, cb) {
  // call the callback with an error to signal authorization failure
  // or with a mapping of claims to values (including scopes).
  cb(null, { claim: 'value' }); // return error or a mapping of access token claims
};
        */})
    }
};

function f(func) {
    return func.toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1].trim();
}