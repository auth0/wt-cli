//
// test/bin/mv.test.js
// wt-cli
//

'use strict';

const lab = exports.lab = require('lab').script();
const describe = lab.describe;
const it = lab.it;
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const request = require('superagent');
const stubs = require('../stubs');

describe('mv.handler', () => {
    it('renames', done => {
        let profile = stubs.profile();
        let sourceWebtask = stubs.webtask();
        let targetWebtask = stubs.webtask();

        let body = {data: '{"counter": 1}'};

        profile.token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
        profile.url = 'http://webtask-proxy.test';
        profile.container = 'wt-test-0';

        sourceWebtask.name = 'demo';
        sourceWebtask.claims = {jtn: 'demo', ten: 'wt-test-0', url: 'https://serverless.test/demo.js'};
        sourceWebtask.sandbox = profile;

        targetWebtask.name = 'demo2';
        targetWebtask.claims = {};
        targetWebtask.sandbox = profile;

        let profileMock = sinon.mock(profile);
        profileMock.expects('getWebtask')
            .withExactArgs({name: sourceWebtask.name})
            .returns(Promise.resolve(sourceWebtask));
        profileMock.expects('createRaw')
            .withExactArgs({jtn: targetWebtask.name, ten: sourceWebtask.claims.ten, url: sourceWebtask.claims.url})
            .returns(Promise.resolve(targetWebtask));
        profileMock.expects('getCronJob')
            .withExactArgs({name: sourceWebtask.name})
            .returns(Promise.resolve({}));
        profileMock.expects('getWebtask')
            .withExactArgs({name: targetWebtask.name, container: profile.container})
            .returns(Promise.resolve(targetWebtask));
        profileMock.expects('createCronJob')
            .withExactArgs({
                name: targetWebtask.name,
                container: profile.container,
                schedule: undefined,
                token: undefined
            })
            .returns(Promise.resolve({}));
        profileMock.expects('removeCronJob')
            .withExactArgs({name: sourceWebtask.name})
            .returns(Promise.resolve(true));

        let sourceWebtaskMock = sinon.mock(sourceWebtask);
        sourceWebtaskMock.expects('inspect')
            .withExactArgs({decrypt: true, fetch_code: true})
            .returns(Promise.resolve(sourceWebtask.claims));

        let requestMock = sinon.mock(request);
        requestMock.expects('get')
            .withExactArgs(`${profile.url}/api/webtask/${profile.container}/${sourceWebtask.name}/data`)
            .returns({set: stubs.wrap({body: body})});
        requestMock.expects('put')
            .withExactArgs(`${profile.url}/api/webtask/${profile.container}/${targetWebtask.name}/data`)
            .returns({
                set: () => {
                    return {send: stubs.wrap({body: {etag: 'testEtagValue'}})};
                }
            });

        let args = {source: sourceWebtask.name, target: targetWebtask.name, profile: profile};
        let mv = proxyquire('../../bin/mv', {
            'superagent': request
        });

        mv.handler(args)
            .then(() => {
                profileMock.verify();
                sourceWebtaskMock.verify();
                done();
            });

    });

    it('moves between containers');

    it('moves between profiles');
});
