var Cli = require('structured-cli');
var Path = require('path');
var _ = require('lodash');
var keyValList2Object = require('./keyValList2Object');
var loadDotEnv = require('./loadDotEnv');

var ip_regex = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/;
var dns_regex = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/;

module.exports = validateCreateArgs;


function validateCreateArgs(args) {
    if (args.host && !args.host.match(ip_regex) && !args.host.match(dns_regex)) {
        throw Cli.error.invalid('--host must specify a valid IP address or DNS domain name');
    }

    if (args.capture && args.watch) {
        throw Cli.error.invalid('--watch is incompatible with --capture');
    }

    if (args.capture && args.bundle) {
        throw Cli.error.invalid('--bundle is incompatible with --capture');
    }

    if (!args.file_or_url && args.bundle) {
        throw Cli.error.invalid('--bundle can not be used when reading from `stdin`');
    }

    if (!args.file_or_url && args.watch) {
        throw Cli.error.invalid('--watch can not be used when reading from `stdin`');
    }

    var fileOrUrl = args.file_or_url;

    if (fileOrUrl && fileOrUrl.match(/^https?:\/\//i)) {
        if (args.watch) {
            throw Cli.error.invalid('The --watch option can only be used '
                + 'when a file name is specified');
        }

        if (args.bundle && !args.capture) {
            throw Cli.error.invalid('The --bundle option can only be used '
                + 'when a file name is specified');
        }

        args.source = 'url';
        args.spec = fileOrUrl;
    } else if (fileOrUrl) {
        if (args.capture) {
            throw Cli.error.invalid('The --capture option can only be used '
            + 'when a url is specified');
        }

        args.source = 'file';
        args.spec = Path.resolve(process.cwd(), fileOrUrl);
    } else {
        args.source = 'stdin';
        args.spec = process.cwd();
    }

    if (!args.name) {
        // The md5 approach is here for redundancy, but in practice, it seems
        // that Path.basename() will resolve to something intelligent all the
        // time.
        args.name = Path.basename(args.spec, Path.extname(args.spec)) || require('crypto')
            .createHash('md5')
            .update(args.spec)
            .digest('hex');
    }

    keyValList2Object(args, 'secrets');
    args.secrets = _.merge(loadDotEnv(), args.secrets);

    keyValList2Object(args, 'params');
    keyValList2Object(args, 'meta');

    return args;
}
