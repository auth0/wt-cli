'use latest';

const hbs         = require('handlebars');
const url         = require('url');
const qs          = require('qs');
const request     = require('request');
const express     = require('express');
const fromExpress = require('webtask-tools').fromExpress;

const app = express();

/** Webtask proxy to authenticate with auth0
 * @param container task tenant
 * @param taskname task to authenticate
 * @param account Auth0 account to use
 */

const VIEW = hbs.compile(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <link rel="shortcut icon" href="https://webtask.io/images/favicon/favicon.ico">

        <title>Authenticate</title>

        <script src="//cdn.auth0.com/js/lock-7.6.2.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/then-request/2.1.1/request.min.js"></script>
      </head>

      <body>
        <script type="application/javascript">
            window.TASK_URL       = '{{{TASK_URL}}}';
            window.CLIENT_ID      = '{{{CLIENT_ID}}}';
            window.AUTH0_DOMAIN   = '{{{AUTH0_DOMAIN}}}';
            window.REQ_METHOD     = '{{{REQ_METHOD}}}';

            window.onload = {{{FUNC_TO_RUN}}};
        </script>
      </body>
    </html>
`);

const FUNC_TO_RUN = function() {
    var lock = new Auth0Lock(CLIENT_ID, AUTH0_DOMAIN);
    var lock_opts = {
        authParams: {
            scope: 'openid email'
        }
    };

    lock.show(lock_opts, function (err, profile, id_token) {
        if(err) return console.log(err);

        var opts = {
            headers: {
                'Authorization': 'Bearer ' + id_token
            }
        };

        request(REQ_METHOD, TASK_URL, opts)
            .then(function (res) {
                switch(res.headers['content-type']) {
                    case 'application/json':
                        var parsed = JSON.parse(res.body);

                        document.body.innerHTML = '<pre>' + JSON.stringify(parsed, null, 1) + '</pre>';
                        break;
                    default:
                        document.body.innerHTML = res.body;
                }
            })
            .catch(function (err) {
                console.log(err);
            });
    });
}.toString();

function getAuthToken (req) {
    if(req.query.key)
        return req.query.key;

    if(req.headers.authorization)
        return req.headers.authorization
            .match(/^bearer\s+(.+)$/i)[1];

    return false;
}

const query_delete = [
    'baseUrl',
    'container',
    'taskname',
    'domain',
    'clientId',
];

app.get('*', (req, res) => {
    const ctx = req.webtaskContext;

    if(!ctx.data.container || !ctx.data.taskname) {
       res.statusCode = 400;
       res.end('Must provide container & taskname params');
    }

    if(!ctx.data.clientId && !ctx.data.domain) {
       res.statusCode = 400;
       res.end('Must provide clientId & domain params');
    }

    let query = qs.parse(
        url.parse(req.url).query
    );

    for(let i in query)
        if(i.match('webtask_') && i !== 'webtask_no_cache')
            delete query[i];

    query_delete
        .forEach(function (key) {
            delete query[key];
        });

    const TASK_URL = (ctx.data.baseUrl   || 'https://webtask.it.auth0.com') +
                   '/api/run/'                 +
                   ctx.data.container          +
                   '/'                         +
                   ctx.data.taskname           +
                   url.parse(req.url).pathname +
                   '?' + qs.stringify(query);

    const AUTH_TOKEN = getAuthToken(req);

    if(AUTH_TOKEN)
        request({
            method: req.method,
            url: TASK_URL,
            headers: {
                Authorization: 'Bearer ' + AUTH_TOKEN
            }
        }).pipe(res);
    else
        res.end(
            VIEW({
                REQ_METHOD: req.method,
                CLIENT_ID: ctx.data.clientId,
                AUTH0_DOMAIN: ctx.data.domain,
                FUNC_TO_RUN,
                TASK_URL
            })
        );
});

module.exports = fromExpress(app);
