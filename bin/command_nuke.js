var program = require('commander')
    , logger = program.wt.logger
    , async = require('async')
    , fs = require('fs')
    , promptly = require('promptly');

program
    .command('nuke')
    .description('nuke all secrets and credentials')
    .option('-q --quiet', 'do not prompt')
    .action(nuke_action);

function nuke_action(name, options) {
    async.series([
        function (cb) {
            if (options.quiet) return cb();
            promptly.confirm('Do you want to remove all secrets and profile information?', function (error, value) {
                if (error) return cb(error);
                if (!value) process.exit(1);
                cb();
            });
        },
        function (cb) {
            fs.writeFileSync(
                program.wt.config_file, 
                '{}',
                'utf8');
            if (!options.quiet)
                console.log('All secrets and profiles deleted. Initialize again with `wt init`.'.green);
            cb();
        }
    ]);    
}
