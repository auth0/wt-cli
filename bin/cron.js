module.exports = function (yargs) {
	console.log(yargs.argv);

	var argv = yargs
		.usage('Usage: $0 cron <command> [options]')
		.command('list', 'list scheduled webtasks', function (yargs) {
			yargs
				.help('h').alias('h', 'help')
		})
		.help('help')
		.argv;

	console.log('nested', argv);
};

function handleListCron (argv) {
	console.log('listing cron jobs');
}