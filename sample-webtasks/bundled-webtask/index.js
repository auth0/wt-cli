var Express = require('express');
var Webtask = require('webtask-tools');

var app = Express();
var externalData = require('./data');


module.exports = Webtask.fromExpress(app);


app.use(require('body-parser').json());

app.get('/', function (req, res) {
    res.json({
        externalData: externalData,
        query: req.query,
        // For demonstration purposes only. Never echo your secrets back like this.
        secrets: req.webtaskContext.secrets,
    });
});

app.post('/', function (req, res) {
    res.json({
        body: req.body,
        externalData: externalData,
        query: req.query,
        // For demonstration purposes only. Never echo your secrets back like this.
        secrets: req.webtaskContext.secrets,
    });
});
