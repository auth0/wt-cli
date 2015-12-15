/* express app as a webtask */

var Express = require('express');
var Webtask = require('webtask-tools');
var app = Express();

app.use(require('body-parser').json());

// POST
app.post('/sample/path', function (req, res) {
    res.json(req.body);
});

// GET
app.get('*', function (req, res) {
    res.json({ id: 1 });
});

// PUT
app.put('*', function (req, res) {
    res.json({ id: 1 });
});

// DELETE
app.delete('*', function (req, res) {
    res.json({ id: 1 })
});

// expose this express app as a webtask-compatible function

module.exports = Webtask.fromExpress(app);
