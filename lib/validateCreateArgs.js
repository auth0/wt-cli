var Cli = require('structured-cli');
var Path = require('path');
var _ = require('lodash');


module.exports = validateCreateArgs;


function validateCreateArgs(args) {
    if (args.capture && args.watch) {
        throw Cli.error.invalid('--watch is incompatible with --capture');
    }
    
    if (args.capture && args.bundle) {
        throw Cli.error.invalid('--bundle is incompatible with --capture');
    }
    
    if (args.loose && !args.bundle) {
        throw Cli.error.invalid('--bundle-loose can only be passed with --bundle');
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
    
    switch (args.type) {
        case 'function':
            args.merge = true;
            args.parse = true;
            break;
        case 'stream':
        case 'express':
            args.merge = true;
            args.parse = false;
            break;
    }
    
    parseKeyValList(args, 'secrets');
    
    return args;
    
    function parseKeyValList(args, field) {
        args[field] = _.reduce(args[field], function (acc, entry) {
            var parts = entry.split('=');
            
            return _.set(acc, parts.shift(), parts.join('='));
        }, {});
    }
}