//
// test/bin/mv.test.js
// wt-cli
//

'use strict';

const lab = exports.lab = require('lab').script();
const describe = lab.describe;
const it = lab.it;
const beforeEach = lab.beforeEach;
const afterEach = lab.afterEach;
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const request = require('superagent');
const stubs = require('../stubs');

describe('mv.handler', () => {
    // Stubs
    let profile, sourceWebtask, targetWebtask;

    // Expectations
    let profileMock, sourceWebtaskMock, requestMock;

    beforeEach(done => {
        profile = stubs.profile();
        sourceWebtask = stubs.webtask();
        targetWebtask = stubs.webtask();

        requestMock = sinon.mock(request);
        profileMock = sinon.mock(profile);
        sourceWebtaskMock = sinon.mock(sourceWebtask);

        profile.token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
        profile.url = 'http://webtask-proxy.test';
        profile.container = 'wt-test-0';

        done();
    });

    afterEach(done => {
        requestMock.restore();
        profileMock.restore();
        sourceWebtaskMock.restore();

        done();
    });

    it('moves to a target name', done => {
        sourceWebtask.name = 'demo';
        sourceWebtask.claims = {jtn: 'demo', ten: 'wt-test-0', url: 'https://serverless.test/demo.js'};
        sourceWebtask.sandbox = profile;

        targetWebtask.name = 'demo2';
        targetWebtask.claims = {};
        targetWebtask.sandbox = profile;

        // Webtask expectations
        sourceWebtaskMock.expects('inspect')
            .withExactArgs({decrypt: true, fetch_code: true})
            .returns(Promise.resolve(sourceWebtask.claims));
        // Superagent expectations
        requestMock.expects('get')
            .withExactArgs(`${profile.url}/api/webtask/${profile.container}/${sourceWebtask.name}/data`)
            .returns({set: stubs.wrap({body: {data: '{"counter": 1}'}})});

        requestMock.expects('put')
            .withExactArgs(`${profile.url}/api/webtask/${profile.container}/${targetWebtask.name}/data`)
            .returns({
                set: () => {
                    return {send: stubs.wrap({body: {etag: 'testEtagValue'}})};
                }
            });
        // Profile expectations
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

        let mv = proxyquire('../../bin/mv', {
            'superagent': request
        });

        mv.handler({
            source: sourceWebtask.name,
            target: targetWebtask.name,
            profile: profile
        }).then(() => {
            profileMock.verify();
            sourceWebtaskMock.verify();

            done();
        }).catch((err) => {
            done(err);
        });

    });

    it('moves to a target container', done => {
        sourceWebtask.name = 'demo';
        targetWebtask.container = 'wt-test-0';
        sourceWebtask.claims = {jtn: 'demo', ten: 'wt-test-0', url: 'https://serverless.test/demo.js'};
        sourceWebtask.sandbox = profile;

        targetWebtask.name = 'demo';
        targetWebtask.container = 'wt-test-1';
        targetWebtask.claims = {};
        targetWebtask.sandbox = profile;

        // Webtask expectations
        sourceWebtaskMock.expects('inspect')
            .withExactArgs({decrypt: true, fetch_code: true})
            .returns(Promise.resolve(sourceWebtask.claims));
        // Superagent expectations
        requestMock.expects('get')
            .withExactArgs(`${profile.url}/api/webtask/${profile.container}/${sourceWebtask.name}/data`)
            .returns({set: stubs.wrap({body: {data: '{"counter": 1}'}})});

        requestMock.expects('put')
            .withExactArgs(`${profile.url}/api/webtask/${targetWebtask.container}/${targetWebtask.name}/data`)
            .returns({
                set: () => {
                    return {send: stubs.wrap({body: {etag: 'testEtagValue'}})};
                }
            });
        // Profile expectations
        profileMock.expects('getWebtask')
            .withExactArgs({name: sourceWebtask.name})
            .returns(Promise.resolve(sourceWebtask));

        profileMock.expects('createRaw')
            .withExactArgs({jtn: targetWebtask.name, ten: targetWebtask.container, url: sourceWebtask.claims.url})
            .returns(Promise.resolve(targetWebtask));

        profileMock.expects('getCronJob')
            .withExactArgs({name: sourceWebtask.name})
            .returns(Promise.resolve({}));

        profileMock.expects('getWebtask')
            .withExactArgs({name: targetWebtask.name, container: targetWebtask.container})
            .returns(Promise.resolve(targetWebtask));

        profileMock.expects('createCronJob')
            .withExactArgs({
                name: targetWebtask.name,
                container: targetWebtask.container,
                schedule: undefined,
                token: undefined
            })
            .returns(Promise.resolve({}));
        profileMock.expects('removeCronJob')
            .withExactArgs({name: sourceWebtask.name})
            .returns(Promise.resolve(true));

        let mv = proxyquire('../../bin/mv', {
            'superagent': request
        });

        // Action
        mv.handler({
            source: sourceWebtask.name,
            targetContainer: targetWebtask.container,
            profile: profile
        }).then(() => {
            profileMock.verify();
            sourceWebtaskMock.verify();

            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('moves to a target profile');
});
