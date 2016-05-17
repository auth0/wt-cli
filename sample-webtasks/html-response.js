/* More on programming models: https://webtask.io/docs/model */

var view = (function view() {/*
    <html>
    <head>
      <title>Welcome to Webtasks</title>
    </head>
    <body>
      <h1>Hello, <%= name %></h1>
    </body>
    </html>
*/}).toString().match(/[^]*\/\*([^]*)\*\/\s*\}$/)[1];

module.exports = 
    function (context, req, res) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(require('ejs').render(view, {
            name: context.data.name || 'Anonymous'
        }));
    }


