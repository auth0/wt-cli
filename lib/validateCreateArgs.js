'use strict';

const _ = require('lodash');
const Cli = require('structured-cli');
const Dotenv = require('dotenv');
const Fs = require('fs');
const Path = require('path');
const Util = require('./util');
const keyValList2Object = require('./keyValList2Object');

const MIDDLWARE_COMPILER = '@webtask/middleware-compiler';
const MIDDLWARE_COMPILER_VERSION = '^1.2.1';
const VALID_DNS_REGEX = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9])$/;
const VALID_IP_REGEX = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/;
const VALID_JTN_REGEX = /^[-a-z0-9._~!$+=:@]+$/i;

module.exports = validateCreateArgs;


function validateCreateArgs(args) {
    if (!args.syntheticDependencies) {
        args.syntheticDependencies = {};
    }

    if (args.profile.openid) {

        // Enforce legacy options are not used

        if (args.params && args.params.length > 0) {
            throw Cli.error.invalid('--param is not supported by the server');
        }

        if (args.merge !== undefined && !args.merge) {
            throw Cli.error.invalid('--no-merge is not supported by the server');   
        }

        if (args.parse) {
            throw Cli.error.invalid('--parse and --no-parse is not supported by the server');   
        }

        if (args.parseBody) {
            throw Cli.error.invalid('--parse-body is not supported by the server');   
        }

    }

    if (args.profile.securityVersion === "v1" && args.secure){
        throw Cli.error.invalid('The `wt create --secure` command is not supported by the target service security configuration.');
    }

    if (args.host && !args.host.match(VALID_IP_REGEX) && !args.host.match(VALID_DNS_REGEX)) {
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

        const resolvedPath = Path.resolve(process.cwd(), Path.dirname(fileOrUrl));
        const packageJsonPath = Path.join(resolvedPath, 'package.json');

        try {
            args.source = 'file';
            args.spec = require.resolve(Path.resolve(process.cwd(), fileOrUrl));
            args.packageJsonPath = !args.ignorePackageJson && Fs.existsSync(packageJsonPath) && packageJsonPath;
        } catch (e) {
            throw new Cli.error.invalid(`Error resolving the path to the webtask code '${ fileOrUrl }'`);
        }
    } else {
        const packageJsonPath = Path.join(process.cwd(), 'package.json');

        args.source = 'stdin';
        args.spec = process.cwd();
        args.packageJsonPath = !args.ignorePackageJson && Fs.existsSync(packageJsonPath) && packageJsonPath;
    }

    if (!Array.isArray(args.dependencies)) {
        args.dependencies = [];
    }

    if (!Array.isArray(args.middleware)) {
        args.middleware = [];
    }

    if (!args.name && args.packageJsonPath) {
        // Attempt to set the webtask name based on the name from the package.json
        try {
            const packageJson = require(args.packageJsonPath);

            args.name = packageJson.name;
        } catch (__) {
            // Do nothing
        }
    }

    // If the name could not be derived from arguments or from package.json,
    // then try to derive it from either the filename or, as a last resort,
    // create a hash of the 'path / url'.
    if (!args.name) {
        // The md5 approach is here for redundancy, but in practice, it seems
        // that Path.basename() will resolve to something intelligent all the
        // time.
        args.name = Path.basename(args.spec, Path.extname(args.spec)) || require('crypto')
            .createHash('md5')
            .update(args.spec)
            .digest('hex');
    } else if (!VALID_JTN_REGEX.test(args.name)) {
        throw new Cli.error.invalid(`Invalid webtask name '${args.name}'.`);
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

    if (args.metaFile) {
        try {
            const filename = Path.resolve(process.cwd(), args.metaFile);
            const content = Fs.readFileSync(filename, 'utf8');
            const meta = Dotenv.parse(content);

            for (let key in meta) {
                if (!args.meta.hasOwnProperty(key)) {
                    args.meta[key] = meta[key];
                }
            }
        } catch (e) {
            throw Cli.error.invalid(`Error loading meta file: ${e.message}`);
        }
    }    

    if (args.middleware.length) {
        if (args.meta && args.meta['wt-compiler'] && args.meta['wt-compiler'] !== MIDDLWARE_COMPILER) {
            throw Cli.error.invalid('Use of middleware is incompatible with a custom webtask compiler.');
        }
        const filter = mw => _.startsWith(mw, 'http') ? 'urls' : 'modules';
        const groups = _.groupBy(args.middleware, filter);
        const middleware = [];

        args.meta['wt-compiler'] = MIDDLWARE_COMPILER;
        args.syntheticDependencies[MIDDLWARE_COMPILER] = MIDDLWARE_COMPILER_VERSION;

        (groups.modules||[])
            .map(Util.parseMiddleware)
            .forEach(middlewareRef => {
                const specWithoutVersion = [middlewareRef.moduleName, middlewareRef.exportName].filter(Boolean).join('/');
                middleware.push(specWithoutVersion);
                args.syntheticDependencies[middlewareRef.moduleName] = middlewareRef.moduleVersion;
            });
        args.meta['wt-middleware'] = _.union(middleware, groups.urls).join(',');
    }

    return args;
}
