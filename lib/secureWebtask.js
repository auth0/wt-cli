const _ = require('lodash');
const Bluebird = require('bluebird');
const Request = Bluebird.promisifyAll(require('request'));
const Cli = require('structured-cli');

const MIDDLWARE_COMPILER = '@webtask/middleware-compiler';
const MIDDLWARE_COMPILER_VERSION = '^1.2.1';
const JWT_MIDDLEWARE = '@webtask/jwt-middleware';
const JWT_MIDDLEWARE_VERSION = '^1.0.0';

module.exports = secureWebtask = (args, options) => {
    return Request.getAsync(args.profile.url + '/api/description').then(res => { 
        addMeta(args, res, options); 
    }).catch(err => {
        throw new Cli.error.serverError(`Unable to secure webtask: ${err.message}`);
    });
}

function addMeta(args, res, options) {

    let body;
    try {
        body = JSON.parse(res[0].body);
    } catch(err) {
        throw new Cli.error.serverError(`Unable to read response from the discovery endpoint.`);
    }

    args.meta['wt-execution-iss'] = body.authorization_server;
    args.meta['wt-execution-aud'] = body.audience;
    
    args.meta['wt-authorize-execution'] = "1";
    
    if (args['execution-scope']) {
        args.meta['wt-execution-scope'] = args['execution-scope'];
    }

    if (!args.meta['wt-compiler']) {
        args.meta['wt-compiler'] = MIDDLWARE_COMPILER;
    }

    let wt_middleware = [];
    if (args.meta['wt-middleware']) {
        wt_middleware = args.meta['wt-middleware'].split(",");
        args.meta['wt-middleware'] = _.union(wt_middleware, [JWT_MIDDLEWARE]).join(',');
    } else {
        args.meta['wt-middleware'] = JWT_MIDDLEWARE;
    }

    if (!args.syntheticDependencies[MIDDLWARE_COMPILER]) {
        args.syntheticDependencies[MIDDLWARE_COMPILER] = MIDDLWARE_COMPILER_VERSION;
    }
    
    args.syntheticDependencies[JWT_MIDDLEWARE] = JWT_MIDDLEWARE_VERSION;
}