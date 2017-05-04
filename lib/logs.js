'use strict';

const Os = require('os');
const PrettyStream = require('bunyan-prettystream');
const Util = require('util');
const _ = require('lodash');


exports.createLogStream = createLogStream;


function createLogStream(profile, options) {
    if (!options) options = {};

    var logStream = profile.createLogStream({ json: true });
    var logger = options.raw
        ?   console
        :   createBunyanLogger();

    logStream.once('open', function () {
        logger.info({ container: options.container || profile.container },
            'connected to streaming logs');
    });

    logStream.once('close', function () {
        logger.emit('close');
    });

    logStream.once('error', function (err) {
        logger.emit('error', err);
    });

    logStream.on('data', function (data) {
        options.verbose
            ?   logger.info(data, data.msg)
            :   logger.info(data.msg);
    });

    return logger;
}


function createBunyanLogger() {
    var prettyStdOut = new PrettyStream({ mode: 'short' });

    prettyStdOut.trace = mkLogEmitter(10);
    prettyStdOut.debug = mkLogEmitter(20);
    prettyStdOut.info = mkLogEmitter(30);
    prettyStdOut.warn = mkLogEmitter(40);
    prettyStdOut.error = mkLogEmitter(50);
    prettyStdOut.fatal = mkLogEmitter(60);

    prettyStdOut.pipe(process.stdout);

    return prettyStdOut;
}

function mkLogEmitter(minLevel) {
    return function() {
        if (arguments.length === 0) {   // `log.<level>()`
            return (this._level <= minLevel);
        }

        const msgArgs = new Array(arguments.length);
        for (let i = 0; i < msgArgs.length; ++i) {
            msgArgs[i] = arguments[i];
        }

        const rec = mkRecord(minLevel, msgArgs);

        this.write(rec);
    };
}

function mkRecord(level, args) {
    var fields, msgArgs;
    if (args[0] instanceof Error) {
        // `log.<level>(err, ...)`
        fields = {
            // Use this Logger's err serializer, if defined.
            err: serializeError(args[0]),
        };
        if (args.length === 1) {
            msgArgs = [fields.err.message];
        } else {
            msgArgs = args.slice(1);
        }
    } else if (typeof (args[0]) !== 'object' || Array.isArray(args[0])) {
        // `log.<level>(msg, ...)`
        fields = null;
        msgArgs = args.slice();
    } else if (Buffer.isBuffer(args[0])) {  // `log.<level>(buf, ...)`
        // Almost certainly an error, show `inspect(buf)`. See bunyan
        // issue #35.
        fields = null;
        msgArgs = args.slice();
        msgArgs[0] = Util.inspect(msgArgs[0]);
    } else {  // `log.<level>(fields, msg, ...)`
        fields = args[0];
        if (fields && args.length === 1 && fields.err &&
            fields.err instanceof Error)
        {
            msgArgs = [fields.err.message];
        } else {
            msgArgs = args.slice(1);
        }
    }

    // Build up the record object.
    var rec = {
        level,
        hostname: Os.hostname(),
        name: 'wt',
        pid: process.pid,
    };
    var recFields = (fields ? _.clone(fields) : null);
    if (recFields) {
        Object.keys(recFields).forEach(function (k) {
            rec[k] = recFields[k];
        });
    }
    rec.msg = Util.format.apply(Util, msgArgs);
    if (!rec.time) {
        rec.time = (new Date());
    }

    return rec;
}

function serializeError(error) {
    if (!error || !error.stack)
        return error;
    return Object.create({
        message: error.message,
        name: error.name,
        stack: getFullErrorStack(error),
        code: error.code,
        signal: error.signal
    }, null);
}

function getFullErrorStack(ex) {
    var ret = ex.stack || ex.toString();
    if (ex.cause && typeof (ex.cause) === 'function') {
        var cex = ex.cause();
        if (cex) {
            ret += '\nCaused by: ' + getFullErrorStack(cex);
        }
    }
    return (ret);
}
