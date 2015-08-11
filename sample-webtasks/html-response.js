/**
* Hello world HTML template. For more on programming models check out https://webtask.io/docs/models
* @param {param} [NAME=Anonymous] - Person to greet
*/

module.exports = 
    function (context, req, res) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(require('ejs').render(view.stringify(), {
            name: context.data.NAME || 'Anonymous'
        }));
    }

function view() {/*
    <html>
    <head>
      <title>Welcome to Webtasks</title>
    </head>
    <body>
      <h1>Hello, <%= name %></h1>
    </body>
    </html>
*/}
