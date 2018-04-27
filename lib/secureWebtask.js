const _ = require('lodash');
const Promise = require('bluebird');
const request = require('superagent');
const Cli = require('structured-cli');
const constants = require('./constans');

module.exports = (args, options) => {

    if (args.meta['wt-execution-iss'] && args.meta['wt-execution-aud']) {

        addMeta(args, options);

        return Promise.resolve();

    } else {

        return request.get(args.profile.url + '/api/description')
        .then(res => {
            extractBody(args, res, options); 
        })
        .catch(err => {
            throw new Cli.error.serverError(`Unable to secure webtask: ${err.message}`);
        });
    }
}

function extractBody(args, res, options) {
    
    if (!res.body) {
        throw new Cli.error.serverError(`Unable to read response from the discovery endpoint.`);
    }

    if (!res.body.authorization_server || !res.body.audience) {
        throw new Cli.error.serverError(`Unable to read response from the discovery endpoint.`);
    }

    args.meta['wt-execution-iss'] = res.body.authorization_server;
    args.meta['wt-execution-aud'] = res.body.audience;

    addMeta(args, options);
}

function addMeta(args, options) {

    args.meta['wt-authorize-execution'] = "1";
    
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