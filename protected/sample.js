module.exports = function(context, req, res) {
	res.end('You are logged in as: ' + JSON.stringify(req.user));
}