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

        <title>Authenticate</title>

        <script src="//cdn.auth0.com/js/lock-7.6.2.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/then-request/2.1.1/request.min.js"></script>
      </head>

      <body>
        <script type="application/javascript">
            window.TASK_URL       = '{{{TASK_URL}}}';
            window.SHARED_ACCOUNT = '{{{SHARED_ACCOUNT}}}'
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

        var user_payload;

        if(SHARED_ACCOUNT) {
            user_payload = request('GET', window.location.href.split('?')[0] + '/verify', { qs: { token: id_token } })
                .then(function (res) {
                    if(res.statusCode === 200) {
                        var opts = {
                            headers: {
                                Authorization: 'Bearer ' + res.body
                            }
                        };

                        return request(REQ_METHOD, TASK_URL, opts);
                    } else {
                        return res;
                    }
                });
        } else {
            var opts = {
                headers: {
                    'Authorization': 'Bearer ' + id_token
                }
            };

            user_payload = request(REQ_METHOD, TASK_URL, opts);
        }

        function injectResponse (res) {
            switch(res.headers['content-type']) {
                case 'application/json':
                    var parsed = JSON.parse(res.body);

                    document.body.innerHTML = '<pre>' + JSON.stringify(parsed, null, 1) + '</pre>';
                    break;
                default:
                    document.body.innerHTML = res.body;
            }
        }

        user_payload
            .then(injectResponse)
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
    'client_id',
    'SHARED_ACCOUNT_URL',
    'TOKEN_SECRET',
    'EMAILS'
];

app.get('/', (req, res) => {
    const ctx = req.webtaskContext;

    if(!ctx.data.container || !ctx.data.taskname) {
       res.statusCode = 400;
       res.end('Must provide container & taskname params');
    }

    if(!ctx.data.client_id && !ctx.data.domain) {
       res.statusCode = 400;
       res.end('Must provide client_id & domain params');
    }

    if (ctx.data.SHARED_ACCOUNT_URL && !ctx.data.TOKEN_SECRET) {
        res.statusCode = 400;
        res.end('Must provide TOKEN_SECRET if usin shared account');
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
                   '/api/run/'        +
                   ctx.data.container +
                   '/'                +
                   ctx.data.taskname  +
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
                CLIENT_ID: ctx.data.client_id,
                AUTH0_DOMAIN: ctx.data.domain,
                SHARED_ACCOUNT: !!ctx.data.SHARED_ACCOUNT_URL,
                FUNC_TO_RUN,
                TASK_URL
            })
        );
});

app.get('/verify', (req, res) => {
    const ctx = req.webtaskContext;

    request.get(ctx.data.SHARED_ACCOUNT_URL, { qs: { token: ctx.data.token } }, function (err, res2) {
        if (err) res.status(502).end(err.message);

        var payload = JSON.parse(res2.body);
        payload.aud = ctx.data.client_id;

        if(ctx.data.EMAILS) {
            if(!payload.email_verified)
                res.status(401).end('account email not verified');

            var passed_emails = ctx.data.EMAILS
              .split(',')
              .filter(function (email) {
                  return payload.email.match(email);
              })

           if(!passed_emails.length)
               res.status(401).end('your email does not authorize you to run this webtask');
        }

        var secret = new Buffer(ctx.data.TOKEN_SECRET, 'base64');
        var token = jwt.sign(payload, secret);

        res.end(token);
    });
});

module.exports = fromExpress(app);
