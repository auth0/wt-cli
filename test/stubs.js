//
// test/stubs.js
// wt-cli
//

function noop() {
    return Promise.resolve(true);
}

module.exports = {
    wrap: function (value) {
        return function () {
            return Promise.resolve(value);
        };
    },
    profile: function () {
        return {
            getWebtask: noop,
            createRaw: noop,
            getCronJob: noop,
            createCronJob: noop,
            removeCronJob: noop
        };
    },
    webtask: function () {
        return {
            inspect: noop,
            remove: noop
        };
    }
};
