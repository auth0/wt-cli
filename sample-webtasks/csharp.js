/* Using C# via Edge.js: http://tjanczuk.github.io/edge */

module.exports = function (cb) {
    require('edge').func(function () {/*
        async (dynamic context) => {
            return "Hello, world from C#!";
        }
    */})(null, cb);
};
