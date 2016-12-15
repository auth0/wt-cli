var fs = require('fs');
var dotenv = require('dotenv');

module.exports = function () {
    var path = '.env';
    var encoding = 'utf8';

    try {
        return dotenv.parse(fs.readFileSync(path, { encoding: encoding }));
    } catch (error) {
        return {};
    }
};
