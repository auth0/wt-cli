/** 
 * Securely connects to a MongoDB instance. 
 * @param {secret} MONGO_URL - Database to connect to
 * @param {string} COLLECTION - Mongo collection to read
 */

var MongoClient = require('mongodb').MongoClient;
var waterfall   = require('async').waterfall;

module.exports = function(context, cb) {

    var MONGO_URL = context.data.MONGO_URL;
    var COLLECTION = context.data.COLLECTION;

    if (!MONGO_URL) return cb(new Error('MONGO_URL secret is missing'));
    if (!COLLECTION) return cb(new Error('COLLECTION param is missing'));

    waterfall([
        function connect_to_db(done) {
            MongoClient.connect(MONGO_URL, function(err, db) {
                if(err) return done(err);

                done(null, db);
            });
      },
      function do_something(db, done) {
          db
              .collection(COLLECTION)
              .insertOne({ msg: 'Hey Mongo!' }, function (err, result) {
                  if(err) return done(err);

                  done(null, result);
              });
      }
    ], cb);
};
