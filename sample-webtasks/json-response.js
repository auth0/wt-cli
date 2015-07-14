module.exports = 
    function (cb) {
        cb(null, {
            now: new Date(),
            flag: true,
            name: 'Auth0',
            amount: 200,
            details: {
                history: [1,2,3,4],
                average: 2.5
            }
        });
    }