/**
* attack memory - look at logs with `wt logs`
*/

module.exports = function (cb) {
    var evil = 'evil';
    more_evil();

    function more_evil() {
        evil += evil;
        console.log('Current length: ' + evil.length);
        process.nextTick(more_evil);
    }
}
