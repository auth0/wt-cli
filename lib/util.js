'use strict';

const MIDDLEWARE_SPEC_RX = /^(@[^/]+\/[^/@]+|[^@/]+)(?:@([^/]+))?(?:\/([^/(]+))?$/;

module.exports = {
    parseMiddleware,
};

function parseMiddleware(spec) {
    const matches = spec.match(MIDDLEWARE_SPEC_RX);

    if (!matches) {
        throw new Error(`Failed to parse middleware spec: ${spec}`);
    }

    const moduleName = matches[1];
    const moduleVersion = matches[2] || '*';
    const exportName = matches[3];

    return { moduleName, moduleVersion, exportName };
}
