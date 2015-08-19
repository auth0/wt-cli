/**
* Templating example, for available models see https://webtask.io/docs/model
* @param {string} [name] - Optionally supply name to greet
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
