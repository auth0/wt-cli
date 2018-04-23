const _ = require('lodash');
const Promise = require('bluebird');
const Request = Promise.promisifyAll(require('request'));
const Cli = require('structured-cli');
const constants = require('./constans');

module.exports = (args, options) => {

    if (args['jwt-audience'] && args['jwt-issuer']) {

        args.meta['wt-execution-iss'] = args['jwt-issuer'];
        args.meta['wt-execution-aud'] = args['jwt-audience'];
        addMeta(args, options);

        return Promise.resolve();

    } else {

        return Request.getAsync(args.profile.url + '/api/description').then(res => {
            extractBody(args, res, options); 
        }).catch(err => {
            throw new Cli.error.serverError(`Unable to secure webtask: ${err.message}`);
        });
    }
}

function extractBody(args, res, options) {
    
    let body;
    try {
        body = JSON.parse(res[0].body);
    } catch(err) {
        throw new Cli.error.serverError(`Unable to read response from the discovery endpoint.`);
    }

    if (!body.authorization_server || !body.audience) {
        throw new Cli.error.serverError(`Unable to read response from the discovery endpoint.`);
    }

    args.meta['wt-execution-iss'] = body.authorization_server;
    args.meta['wt-execution-aud'] = body.audience;

    addMeta(args, options);
}

function addMeta(args, options) {

    args.meta['wt-authorize-execution'] = "1";
    
    if (args['execution-scope']) {
        args.meta['wt-execution-scope'] = args['execution-scope'];
    }

    if (!args.meta['wt-compiler']) {
        args.meta['wt-compiler'] = constants.MIDDLWARE_COMPILER
    }

    let wt_middleware = [];
    if (args.meta['wt-middleware']) {
        wt_middleware = args.meta['wt-middleware'].split(",");
        args.meta['wt-middleware'] = _.union(wt_middleware, [constants.JWT_MIDDLEWARE]).join(',');
    } else {
        args.meta['wt-middleware'] = constants.JWT_MIDDLEWARE;
    }

    if (!args.syntheticDependencies[constants.MIDDLWARE_COMPILER]) {
        args.syntheticDependencies[constants.MIDDLWARE_COMPILER] = constants.MIDDLWARE_COMPILER_VERSION;
    }
    
    args.syntheticDependencies[constants.JWT_MIDDLEWARE] = constants.JWT_MIDDLEWARE_VERSION;
}