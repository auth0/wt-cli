'use strict';

const Bluebird = require('bluebird');
const Chalk = require('chalk');
const Child = require('child_process');
const Cli = require('structured-cli');
const Dedent = require('dedent');
const Fs = require('fs');
const Mkdirp = require('mkdirp');
const Path = require('path');
const _ = require('lodash');


const templates = {
    basic: {
        files: {
            '.secrets': Dedent`
                # Add secrets, one per line as KEY=VALUE
            `,
            'webtask.js': Dedent`
                'use strict';

                module.exports = (ctx, cb) => {
                    return cb(null, 'Hello webtask!');
                };
            `,
        },
    },
    express: {
        files: {
            '.secrets': Dedent`
                # Add secrets, one per line as KEY=VALUE
            `,
            'webtask.js': Dedent`
                'use strict';

                const BodyParser = require('body-parser');
                const Express = require('express');
                const WebtaskTools = require('webtask-tools');

                const app = Express();

                app.use(BodyParser.json());

                app.get('/', (req, res) => {
                    res.send('Hello webtask!');
                });

                module.exports = WebtaskTools.fromExpress(app);
            `,
        },
        packageJson: {
            dependencies: {
                'body-parser': '^1.15.2',
                'express': '^4.14.1',
                'webtask-tools': '^3.1.1',
            },
        },
    },
};

module.exports = Cli.createCommand('scaffold', {
    handler,
    description: 'Scaffold a new webtask project',
    options: {
        'template': {
            alias: 't',
            type: 'string',
            defaultValue: 'basic',
            choices: Object.keys(templates),
            description: 'Select the template to use for scaffolding your webtask',
        },
    },
    params: {
        'path': {
            description: 'The folder where the webtask will be scaffolded',
            type: 'string',
            required: true,
        },
    },
});


// Command handler

function handler(args) {
    const pathname = Path.resolve(process.cwd(), args.path);
    const name = Path.basename(pathname);
    const template = templates[args.template];
    const packageJson = _.defaultsDeep(template.packageJson, {
        name,
        dependencies: {},
        description: 'Who needs servers when they have Webtask?',
        scripts: {
            create: `wt create --secrets-file .secrets --name ${name} webtask.js`,
            debug: 'wt debug --secrets-file .secrets webtask.js',
            start: 'wt serve --secrets-file .secrets webtask.js',
        },
        version: '1.0.0',
    });
    const mkdirp = Bluebird.promisify(Mkdirp);
    const stat = Bluebird.promisify(Fs.stat);

    const files = _.defaults(template.files, {
        'package.json': JSON.stringify(packageJson, null, 2),
    });

    return stat(pathname)
        .then(stats => {
            if (!stats.isDirectory()) {
                throw Cli.error.invalid(`The path ${pathname} already exists. `);
            }
        }, (error) => {
            if (error.code !== 'ENOENT') throw Cli.error.invalid(`Error preparing scaffold directory: ${error.message}`);

            return mkdirp(pathname);
        })
        .tap(() => {
            console.log('Creating files...');
        })
        .then(() => createFiles(pathname, files))
        .tap(() => {
            console.log('Installing dependencies...');
        })
        .then(() => installDependencies(pathname))
        .tap(() => {
            console.log(Chalk.green(`Successfully scaffolded a webtask project in ${pathname} using the template ${args.template}`));
        });
}

function createFiles(dirname, files) {
    const filenames = Object.keys(files);
    const close = Bluebird.promisify(Fs.close);
    const open = Bluebird.promisify(Fs.open);
    const write = Bluebird.promisify(Fs.write);
    const entries$ = filenames.map(filename => {
        const pathname = Path.join(dirname, filename);

        return Bluebird.props({
            pathname,
            content: files[filename],
            fd: open(pathname, 'wx'),
        })
            .disposer(entry => close(entry.fd));
    });

    return Bluebird.using(entries$, entries => {
        return Bluebird.map(entries, entry => write(entry.fd, entry.content));
    });
}

function installDependencies(cwd) {
    const entrypoint = [
        'npm',
        'install',
        '--silent',
    ];
    const execFile = Bluebird.promisify(Child.execFile, { multiArgs: true });

    return execFile(entrypoint[0], entrypoint.slice(1), { cwd });
}
