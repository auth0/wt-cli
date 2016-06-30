var Chalk = require('chalk');
var Cli = require('structured-cli');
var _ = require('lodash');

module.exports = Cli.createCommand('mv', {
    description: 'Move a named webtask',
    plugins: [
        require('./_plugins/profile'),
    ],
    options: {
        'target-container': {
            description: 'Target container',
            type: 'string',
            dest: 'targetContainer'
        },
        'target-profile': {
            description: 'Target profile',
            type: 'string',
            dest: 'targetProfile'
        },
    },
    params: {
        'source': {
            description: 'Webtask name',
            type: 'string',
            required: true,
        },
        'target': {
            description: 'Webtask name',
            type: 'string',
            required: false,
        },
    },
    handler: handleWebtaskMove,
});

function handleWebtaskMove(args) {

    /**
     * @type {WebtaskProfile}
     */
    moveWebtask(args.source, args.target || args.source, _.pick(args, ['targetContainer', 'targetProfile']))
}

function moveWebtask(source, target, options) {
    // TODO: 
    console.log(Chalk.yellow('moveWebtask:') + ' source=%j, target=%j, options=%j', source, target, options);
}