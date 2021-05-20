module.exports = function (ctx, cb) {
  
    var Twitter = require('twit');

    var API_KEY = ctx.data.API_KEY;
    var API_SECRET = ctx.data.API_SECRET;
    var ACCESS_TOKEN = ctx.data.ACCESS_TOKEN;
    var ACCESS_TOKEN_SECRET = ctx.data.ACCESS_TOKEN_SECRET;

    var secret = {
      consumer_key: API_KEY,
      consumer_secret: API_SECRET,
      access_token: ACCESS_TOKEN,
      access_token_secret: ACCESS_TOKEN_SECRET
    };
  
    var twitter = new Twitter(secret);
  
    twitter.get('search/tweets', { q: 'auth0' }, function (error, tweets) {
      console.log(tweets);
      cb(null,tweets);
    });
    
};


