/**
* Securely connect to a MongoDB instance
* @param {secret} MONGO_URL - MongoDB URL
* @param {string} COLLECTION - Collection to read
*/

var MongoClient = require('mongodb').MongoClient;
var waterfall   = require('async').waterfall;

module.exports = function(context, cb) {
    var MONGO_URL = context.data.MONGO_URL;
    var COLLECTION = context.data.COLLECTION;

    waterfall([
        function connect_to_db(done) {
            MongoClient.connect(MONGO_URL, function(err, db) {
                if(err) return done(err);

                done(null, db);
            });
      },
      function do_something(db, done) {
          db
              .collection('my-collection')
              .insertOne({ msg: 'Hey Mongo!' }, function (err, result) {
                  if(err) return done(err);

                  done(null, result);
              });
      }
    ], cb);
};
