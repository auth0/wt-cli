//
// test/stubs.js
// wt-cli
//

function noop() {
    return Promise.resolve(undefined);
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
            removeCronJob: noop,
            listWebtasks: noop
        };
    },
    webtask: function () {
        return {
            inspect: noop,
            remove: noop
        };
    }
};
