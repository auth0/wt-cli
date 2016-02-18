module.exports = {
    onBeforeConfigure: onBeforeConfigure,
};


function onBeforeConfigure(context) {
    var node = context.node;
    
    node.addOptionGroup('Webtask profile', {
        profile: {
            alias: 'p',
            description: 'Use a saved webtask profile',
            type: 'string',
        },
        container: {
            alias: 'c',
            description: 'Set the webtask container',
            type: 'string',
        },
        cluster: {
            description: 'Set the webtask cluster url',
            type: 'string',
        },
        token: {
            description: 'Set your authorizing webtask token',
            type: 'string',
        },
    });
}