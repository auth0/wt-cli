module.exports = () => {
    return {
        optionGroups: {
            'Server options': {
                port: {
                    alias: 'p',
                    description: 'Port on which the webtask server will listen',
                    type: 'int',
                    defaultValue: 8080,
                },
                'hostname': {
                    description: 'The hostname for the http listener',
                    type: 'string',
                    defaultValue: '0.0.0.0',
                },
            },
            'Webtask creation': {
                'secret': {
                    action: 'append',
                    alias: 's',
                    defaultValue: [],
                    description: 'Secret(s) exposed to your code as `secrets` on the webtask context object. These secrets will be encrypted and stored in a webtask token in such a way that only the webtask server is able to decrypt the secrets so that they may be exposed to your running webtask code.',
                    dest: 'secrets',
                    metavar: 'KEY=VALUE',
                    type: 'string',
                },
                'param': {
                    action: 'append',
                    defaultValue: [],
                    description: 'Param(s) exposed to your code as `params` on the webtask context object. The properties will be signed and protected from interference but not encrypted.',
                    dest: 'params',
                    metavar: 'KEY=VALUE',
                    type: 'string',
                },
                'no-merge': {
                    action: 'storeFalse',
                    defaultValue: true,
                    description: 'Disable automatic merging of the parsed body and secrets into the `data` field of the webtask context object. The parsed body (if available) will be on the `body` field and secrets on the `secrets` field.',
                    dest: 'mergeBody',
                },
                'no-parse': {
                    description: 'Deprecated and ignored.'
                },
                'parse-body': {
                    descrption: 'Automatically parse JSON and application/x-www-form-urlencoded request bodies. Use this with (ctx, req, res) webtask signatures if you want webtask runtime to parse the reqeust body and store it in ctx.body.',
                    type: 'boolean',
                    dest: 'parseBody'
                },
                'storage-file': {
                    description: 'Provide a file that will be used to initialize and persist webtask storage data',
                    dest: 'storageFile',
                },
            },
        },
        params: {
            'filename': {
                description: 'The path to the webtask\'s source code',
                type: 'string',
                required: true,
            },
        }
    }
}