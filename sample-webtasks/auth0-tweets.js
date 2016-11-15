var Express = require('express');
var Twitter = require('twit');
var Webtask = require('webtask-tools');

var app = Express();

app.use(require('body-parser').json());

var API_KEY = "fekTlACzGXVbJxEcLci9Zxz6K";
var API_SECRET = "dG4hOTSJWPdHbR5xcDfo9T8QgWS3aXhjK44ycoec7P264wqGQk";
var ACCESS_TOKEN = "4026347956-4s00pRs6E9H2vF3VxwiENljUG1ntv0ChR2pQ9r9";
var ACCESS_TOKEN_SECRET = "TCGKQwvZtgtWRd1bejbGoLHapv1xA740D4W2iisanQKJA";

var secret = {
  consumer_key: API_KEY,
  consumer_secret: API_SECRET,
  access_token: ACCESS_TOKEN,
  access_token_secret: ACCESS_TOKEN_SECRET
};

var twitter = new Twitter(secret);

// GET tweets
app.get('*', function (req, res) {
  twitter.get('search/tweets', { q: 'auth0' }, function (error, tweets) {
    console.log(tweets);
    res.json(tweets);
  });  
});

// expose this express app as a webtask-compatible function
module.exports = Webtask.fromExpress(app);
