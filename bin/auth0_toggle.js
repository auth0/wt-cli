const Cli = require('structured-cli');
const Chalk = require('chalk');


module.exports = function (action) {
    return Cli.createCommand(action, {
        description: (action === 'enable' ? 'Enable' : 'Disable') + ' a hook',
        plugins: [
            require('./_plugins/profile'),
        ],
        params: {
            'name': {
                description: 'The name of the hook to ' + action + '.',
                type: 'string',
                required: true,
            }
        },
        handler: createHandleUpdate(action),
    });
};

// Command handler

function createHandleUpdate(action) {
    return function handleUpdate(args) {

        var profile = args.profile;

        return profile.inspectWebtask({ 
            name: args.name, 
            decrypt: true,
            meta: true 
        })
        .then(onClaims);

        function onClaims(claims) {
            // Set the user-defined options from the inspected webtask's claims
            if (!claims.meta || claims.meta['auth0-extension'] !== 'runtime')
                return Cli.error.invalid('The ' + args.name + ' webtask is not an Auth0 hook.');
            var extensionName = claims.meta['auth0-extension-name'];
            if (!extensionName)
                return Cli.error.invalid('The ' + args.name + ' webtask is not a an Auth0 hook.');
            if (action === 'enable' && !claims.meta['auth0-extension-disabled'])
                return console.log(Chalk.green('The ' + args.name + ' (' + extensionName + ') hook is already enabled.'));
            if (action === 'disable' && claims.meta['auth0-extension-disabled'])
                return console.log(Chalk.green('The ' + args.name + ' (' + extensionName + ') hook is already disabled.'));

            if (action === 'disable') {
                claims = adjustExtensionClaims(claims, false);
                return profile.createTokenRaw(claims)
                .then(function () {
                    return console.log(Chalk.green('The ' + args.name + ' (' + extensionName + ') hook has been disabled.'));
                });
            }
            else { // enable
                return profile.listWebtasks({
                    meta: {
                        'auth0-extension': 'runtime',
                        'auth0-extension-name': extensionName
                    }
                }).then(function (webtasks) {
                    var toDisable = [];
                    webtasks.forEach(function (wt) {
                        if (!wt.meta['auth0-extension-disabled']) {
                            toDisable.push(toggleExtension(wt.toJSON().name, false));
                        }
                    });
                    return Promise.all(toDisable);
                }).then(function () {
                    claims = adjustExtensionClaims(claims, true);
                    return profile.createTokenRaw(claims)
                    .then(function () {
                        return console.log(Chalk.green('The ' + args.name + ' (' + extensionName + ') hook has been enabled.'));
                    });
                });
            }
        }

        function toggleExtension(name, enable) {
            return profile.inspectWebtask({ name, meta: true, decrypt: true })
            .then(function (claims) {
                claims = adjustExtensionClaims(claims, enable);
                return profile.createTokenRaw(claims);
            });
        }

        function adjustExtensionClaims(claims, enable) {
            if (enable) {
                console.log('Enabling hook ' + claims.jtn + '.');
                delete claims.meta['auth0-extension-disabled'];
            }
            else {
                console.log('Disabling hook ' + claims.jtn + '.');
                claims.meta['auth0-extension-disabled'] = '1';   
            }
            ['jti','ca','iat','webtask_url'].forEach(function (c) { delete claims[c]; });
            return claims;
        }
    };
}

