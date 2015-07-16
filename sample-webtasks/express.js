/* express app as a webtask */

var Express = require('express');
var Webtask = require('webtask-tools');
var app = Express();

// POST
app.post('*', function (req, res) {
    res.send(200);
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
