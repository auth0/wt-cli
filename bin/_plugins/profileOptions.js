module.exports = {
    onBeforeConfigure: onBeforeConfigure,
};


function onBeforeConfigure(context) {
    var node = context.node;
    
    node.addOptionGroup('Webtask profile', {
        profile: {
            alias: 'p',
            description: 'Default to the webtask container, token, and URL from a stored profile',
            type: 'string',
        },
        container: {
            alias: 'c',
            description: 'Set the webtask container',
            type: 'string',
        },
        url: {
            description: 'Set the webtask server url',
            type: 'string',
        },
        token: {
            description: 'Set your authorizing webtask token',
            type: 'string',
        },
    });
}