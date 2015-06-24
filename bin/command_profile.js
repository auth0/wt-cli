var program = require('commander')
    , logger = program.wt.logger
    , async = require('async')
    , fs = require('fs')
    , promptly = require('promptly');

program
    .command('profile-ls')
    .description('list profiles')
    .option('-j --json', 'json output')
    .option('-d --details', 'show more details')
    .action(profile_ls_action);

function profile_ls_action(options) {
    var profiles = Object.keys(program.wt.config);
    if (profiles.length === 0) {
        if (options.json)
            console.log('{}');
        else
            console.log('No profiles are configured. Create one with `wt init`.'.red);
    }
    else if (options.json) {
        console.log(program.wt.config)
    }
    else {
        profiles.forEach(function (profile) {
            program.wt.print_profile(profile, program.wt.config[profile], options.details);
            console.log();
        });
    }
}

program
    .command('profile-get [name] [field]')
    .description('get profile info')
    .option('-j --json', 'json output')
    .option('-d --details', 'show more details')
    .action(profile_get_action);

function profile_get_action(name, field, options) {
    name = name || 'default';
    if (!program.wt.config[name]) {
        console.error(('Profile `' + name + '` does not exist.').red);
        process.exit(1);
    }
    if (field) {
        if (!program.wt.config[name][field]) {
            console.error(('Field `' + field + '` does not exist.').red);
            process.exit(1);
        }
        if (options.json) {
            console.log(JSON.stringify(program.wt.config[name][field]));
        }
        else {
            console.log(program.wt.config[name][field]);
        }
    }
    else {
        if (options.json) {
            console.log(program.wt.config[name]);
        }
        else {
            program.wt.print_profile(name, program.wt.config[name], options.details);
        }
    }
}

program
    .command('profile-rm <name>')
    .description('remove profile')
    .option('-q --quiet', 'do not prompt')
    .action(profile_rm_action);

function profile_rm_action(name, options) {
    if (!program.wt.config[name]) {
        if (!options.quiet)
            console.log(('Profile `' + name + '` does not exist.').green);
        return;
    }
    async.series([
        function (cb) {
            if (options.quiet) return cb();
            promptly.confirm('Do you want to remove profile `' + name + '`? ', function (error, value) {
                if (error) return cb(error);
                if (!value) process.exit(1);
                cb();
            });
        },
        function (cb) {
            delete program.wt.config[name];
            fs.writeFileSync(
                program.wt.config_file, 
                JSON.stringify(program.wt.config, null, 2),
                'utf8');
            if (!options.quiet)
                console.log(('Profile `' + name + '` deleted.').green);
            cb();
        }
    ]);    
}
