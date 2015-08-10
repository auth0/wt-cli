/**
* Hello world HTML template. For more on programming models check out https://webtask.io/docs/models
*/

module.exports = 
    function (context, req, res) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(require('ejs').render(view.stringify(), {
            name: context.data.name || 'Anonymous'
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
