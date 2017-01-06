'use strict';

const Cli = require('structured-cli');
const Dotenv = require('dotenv');
const Fs = require('fs');
const Path = require('path');
const keyValList2Object = require('./keyValList2Object');
const _ = require('lodash');

const ip_regex = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/;
const dns_regex = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/;

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

    const fileOrUrl = args.file_or_url;

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
        args.packageJsonPath = null;
    } else if (fileOrUrl) {
        if (args.capture) {
            throw Cli.error.invalid('The --capture option can only be used '
            + 'when a url is specified');
        }

        args.source = 'file';
        args.spec = Path.resolve(process.cwd(), fileOrUrl);
        args.packageJsonPath = Path.join(Path.dirname(fileOrUrl), 'package.json');
    } else {
        args.source = 'stdin';
        args.spec = process.cwd();
        args.packageJsonPath = Path.join(process.cwd(), 'package.json');
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
    keyValList2Object(args, 'params');
    keyValList2Object(args, 'meta');

    if (args.secretsFile) {
        try {
            const filename = Path.resolve(process.cwd(), args.secretsFile);
            const content = Fs.readFileSync(filename, 'utf8');
            const secrets = Dotenv.parse(content);

            for (let secret in secrets) {
                if (!args.secrets.hasOwnProperty(secret)) {
                    args.secrets[secret] = secrets[secret];
                }
            }
        } catch (e) {
            throw Cli.error.invalid(`Error loading secrets file: ${e.message}`);
        }
    }


    return args;
}
