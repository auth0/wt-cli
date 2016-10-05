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
const ConfigFile = require('../../lib/config');


describe('mv.handler', () => {
    // Stubs
    let sourceProfile, targetProfile, sourceWebtask, targetWebtask, sourceCronJob;

    // Expectations
    let sourceProfileMock, targetProfileMock, sourceWebtaskMock, requestMock;

    beforeEach(done => {
        sourceProfile = stubs.profile();
        targetProfile = stubs.profile();
        sourceWebtask = stubs.webtask();
        targetWebtask = stubs.webtask();

        requestMock = sinon.mock(request);
        sourceProfileMock = sinon.mock(sourceProfile);
        targetProfileMock = sinon.mock(targetProfile);
        sourceWebtaskMock = sinon.mock(sourceWebtask);

        sourceProfile.token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.0';
        sourceProfile.url = 'http://source-proxy.test';
        sourceProfile.container = 'wt-test-0';

        targetProfile.token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.0';
        targetProfile.url = 'http://target-proxy.test';
        targetProfile.container = 'wt-test-0';

        sourceCronJob = {
            container: sourceProfile.container,
            created_at: '2016-07-07T10:18:56.813Z',
            error_count: 0,
            last_scheduled_at: '2016-10-05T12:50:00.110Z',
            meta: {},
            name: '',
            next_available_at: '2016-10-05T12:50:00.110Z',
            results: [],
            run_count: 0,
            schedule: '*/5 * * * *',
            state: 'active'
        };


        done();
    });

    afterEach(done => {
        requestMock.restore();
        sourceProfileMock.restore();
        targetProfileMock.restore();
        sourceWebtaskMock.restore();

        done();
    });

    it('moves to a target name', done => {
        sourceWebtask.name = 'demo';
        sourceWebtask.claims = {jtn: 'demo', ten: 'wt-test-0', url: 'https://serverless.test/demo.js'};
        sourceWebtask.sandbox = sourceProfile;
        sourceWebtask.token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.1';

        targetWebtask.name = 'demo2';
        targetWebtask.claims = {};
        targetWebtask.sandbox = sourceProfile;
        targetWebtask.token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.2';

        // Webtask expectations
        sourceWebtaskMock.expects('inspect')
            .withExactArgs({decrypt: true, fetch_code: true})
            .returns(Promise.resolve(sourceWebtask.claims));
        // Superagent expectations
        requestMock.expects('get')
            .withExactArgs(`${sourceProfile.url}/api/webtask/${sourceProfile.container}/${sourceWebtask.name}/data`)
            .returns({set: stubs.wrap({body: {data: '{"counter": 1}'}})});

        requestMock.expects('put')
            .withExactArgs(`${sourceProfile.url}/api/webtask/${sourceProfile.container}/${targetWebtask.name}/data`)
            .returns({
                set: () => {
                    return {send: stubs.wrap({body: {etag: 'testEtagValue'}})};
                }
            });
        // Profile expectations
        sourceProfileMock.expects('getWebtask')
            .withExactArgs({name: sourceWebtask.name})
            .returns(Promise.resolve(sourceWebtask));
        sourceProfileMock.expects('createRaw')
            .withExactArgs({jtn: targetWebtask.name, ten: sourceWebtask.claims.ten, url: sourceWebtask.claims.url})
            .returns(Promise.resolve(targetWebtask));
        sourceProfileMock.expects('getCronJob')
            .withExactArgs({name: sourceWebtask.name})
            .returns(Promise.resolve(sourceCronJob));
        sourceProfileMock.expects('getWebtask')
            .withExactArgs({name: targetWebtask.name, container: sourceProfile.container})
            .returns(Promise.resolve(targetWebtask));
        sourceProfileMock.expects('createCronJob')
            .withExactArgs({
                name: targetWebtask.name,
                container: sourceProfile.container,
                schedule: sourceCronJob.schedule,
                state: sourceCronJob.state,
                token: targetWebtask.token
            })
            .returns(Promise.resolve({}));
        sourceProfileMock.expects('removeCronJob')
            .withExactArgs({name: sourceWebtask.name})
            .returns(Promise.resolve(true));

        // Action
        let mv = proxyquire('../../bin/mv', {
            'superagent': request
        });
        mv.handler({
            source: sourceWebtask.name,
            target: targetWebtask.name,
            profile: sourceProfile
        }).then(() => {
            sourceProfileMock.verify();
            targetProfileMock.verify();
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
        sourceWebtask.sandbox = sourceProfile;

        targetWebtask.name = 'demo';
        targetWebtask.container = 'wt-test-1';
        targetWebtask.claims = {};
        targetWebtask.sandbox = sourceProfile;

        // Webtask expectations
        sourceWebtaskMock.expects('inspect')
            .withExactArgs({decrypt: true, fetch_code: true})
            .returns(Promise.resolve(sourceWebtask.claims));
        // Superagent expectations
        requestMock.expects('get')
            .withExactArgs(`${sourceProfile.url}/api/webtask/${sourceProfile.container}/${sourceWebtask.name}/data`)
            .returns({set: stubs.wrap({body: {data: '{"counter": 1}'}})});

        requestMock.expects('put')
            .withExactArgs(`${sourceProfile.url}/api/webtask/${targetWebtask.container}/${targetWebtask.name}/data`)
            .returns({
                set: () => {
                    return {send: stubs.wrap({body: {etag: 'testEtagValue'}})};
                }
            });
        // Profile expectations
        sourceProfileMock.expects('getWebtask')
            .withExactArgs({name: sourceWebtask.name})
            .returns(Promise.resolve(sourceWebtask));
        sourceProfileMock.expects('createRaw')
            .withExactArgs({jtn: targetWebtask.name, ten: targetWebtask.container, url: sourceWebtask.claims.url})
            .returns(Promise.resolve(targetWebtask));
        sourceProfileMock.expects('getCronJob')
            .withExactArgs({name: sourceWebtask.name})
            .returns(Promise.resolve(sourceCronJob));
        sourceProfileMock.expects('getWebtask')
            .withExactArgs({name: targetWebtask.name, container: targetWebtask.container})
            .returns(Promise.resolve(targetWebtask));
        sourceProfileMock.expects('createCronJob')
            .withExactArgs({
                name: targetWebtask.name,
                container: targetWebtask.container,
                schedule: sourceCronJob.schedule,
                state: sourceCronJob.state,
                token: targetWebtask.token
            })
            .returns(Promise.resolve({}));
        sourceProfileMock.expects('removeCronJob')
            .withExactArgs({name: sourceWebtask.name})
            .returns(Promise.resolve(true));

        // Action
        let mv = proxyquire('../../bin/mv', {
            'superagent': request
        });
        mv.handler({
            source: sourceWebtask.name,
            targetContainer: targetWebtask.container,
            profile: sourceProfile
        }).then(() => {
            sourceProfileMock.verify();
            targetProfileMock.verify();
            sourceWebtaskMock.verify();

            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('moves to a target profile', done => {
        sourceWebtask.name = 'demo';
        sourceWebtask.container = 'wt-test-0';
        sourceWebtask.claims = {jtn: 'demo', ten: 'wt-test-0', url: 'https://serverless.test/demo.js'};
        sourceWebtask.sandbox = sourceProfile;

        targetWebtask.name = 'demo';
        targetWebtask.container = 'wt-test-0';
        targetWebtask.profile = 'other';
        targetWebtask.claims = {};
        targetWebtask.sandbox = targetProfile;

        // ConfigFile expectations
        let config = new ConfigFile();
        let configMock = sinon.mock(config);
        configMock.expects('getProfile')
            .withExactArgs(targetWebtask.profile)
            .returns(Promise.resolve(targetProfile));
        // Webtask expectations
        sourceWebtaskMock.expects('inspect')
            .withExactArgs({decrypt: true, fetch_code: true})
            .returns(Promise.resolve(sourceWebtask.claims));
        // Superagent expectations
        requestMock.expects('get')
            .withExactArgs(`${sourceProfile.url}/api/webtask/${sourceProfile.container}/${sourceWebtask.name}/data`)
            .returns({set: stubs.wrap({body: {data: '{"counter": 1}'}})});

        requestMock.expects('put')
            .withExactArgs(`${targetProfile.url}/api/webtask/${targetWebtask.container}/${targetWebtask.name}/data`)
            .returns({
                set: () => {
                    return {send: stubs.wrap({body: {etag: 'testEtagValue'}})};
                }
            });
        // Profile expectations
        sourceProfileMock.expects('getWebtask')
            .withExactArgs({name: sourceWebtask.name})
            .returns(Promise.resolve(sourceWebtask));
        sourceProfileMock.expects('getCronJob')
            .withExactArgs({name: sourceWebtask.name})
            .returns(Promise.resolve(sourceCronJob));
        sourceProfileMock.expects('getWebtask')
            .withExactArgs({name: targetWebtask.name, container: targetWebtask.container})
            .returns(Promise.resolve(targetWebtask));
        sourceProfileMock.expects('removeCronJob')
            .withExactArgs({name: sourceWebtask.name})
            .returns(Promise.resolve(true));
        targetProfileMock.expects('createRaw')
            .withExactArgs({jtn: targetWebtask.name, ten: targetWebtask.container, url: sourceWebtask.claims.url})
            .returns(Promise.resolve(targetWebtask));
        targetProfileMock.expects('createCronJob')
            .withExactArgs({
                name: targetWebtask.name,
                container: sourceProfile.container,
                schedule: sourceCronJob.schedule,
                state: sourceCronJob.state,
                token: targetWebtask.token
            })
            .returns(Promise.resolve({}));

        // Action
        let mv = proxyquire('../../bin/mv', {
            'superagent': request,
            '../lib/config': function () {
                return config;
            }
        });
        mv.handler({
            source: sourceWebtask.name,
            targetProfile: targetWebtask.profile,
            profile: sourceProfile
        }).then(() => {
            sourceProfileMock.verify();
            targetProfileMock.verify();
            sourceWebtaskMock.verify();

            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('moves all tasks in a profile', done => {
        sourceWebtask.name = 'demo';
        targetWebtask.container = 'wt-test-0';
        sourceWebtask.claims = {jtn: 'demo', ten: 'wt-test-0', url: 'https://serverless.test/demo.js'};
        sourceWebtask.sandbox = sourceProfile;

        targetWebtask.name = 'demo';
        targetWebtask.container = 'wt-test-1';
        targetWebtask.claims = {};
        targetWebtask.sandbox = sourceProfile;

        // Webtask expectations
        sourceWebtaskMock.expects('inspect')
            .withExactArgs({decrypt: true, fetch_code: true})
            .returns(Promise.resolve(sourceWebtask.claims));
        // Superagent expectations
        requestMock.expects('get')
            .withExactArgs(`${sourceProfile.url}/api/webtask/${sourceProfile.container}/${sourceWebtask.name}/data`)
            .returns({set: stubs.wrap({body: {data: '{"counter": 1}'}})});

        requestMock.expects('put')
            .withExactArgs(`${sourceProfile.url}/api/webtask/${targetWebtask.container}/${targetWebtask.name}/data`)
            .returns({
                set: () => {
                    return {send: stubs.wrap({body: {etag: 'testEtagValue'}})};
                }
            });
        // Profile expectations
        sourceProfileMock.expects('listWebtasks')
            .returns(Promise.resolve([sourceWebtask]));
        sourceProfileMock.expects('getWebtask')
            .withExactArgs({name: sourceWebtask.name})
            .returns(Promise.resolve(sourceWebtask));
        sourceProfileMock.expects('createRaw')
            .withExactArgs({jtn: targetWebtask.name, ten: targetWebtask.container, url: sourceWebtask.claims.url})
            .returns(Promise.resolve(targetWebtask));
        sourceProfileMock.expects('getCronJob')
            .withExactArgs({name: sourceWebtask.name})
            .returns(Promise.resolve(sourceCronJob));
        sourceProfileMock.expects('getWebtask')
            .withExactArgs({name: targetWebtask.name, container: targetWebtask.container})
            .returns(Promise.resolve(targetWebtask));
        sourceProfileMock.expects('createCronJob')
            .withExactArgs({
                name: targetWebtask.name,
                container: targetWebtask.container,
                schedule: sourceCronJob.schedule,
                state: sourceCronJob.state,
                token: targetWebtask.token
            })
            .returns(Promise.resolve({}));
        sourceProfileMock.expects('removeCronJob')
            .withExactArgs({name: sourceWebtask.name})
            .returns(Promise.resolve(true));

        // Action
        let mv = proxyquire('../../bin/mv', {
            'superagent': request
        });

        mv.handler({
            targetContainer: targetWebtask.container,
            profile: sourceProfile
        }).then(() => {
            sourceProfileMock.verify();
            sourceWebtaskMock.verify();

            done();
        }).catch((err) => {
            done(err);
        });
    });
});
