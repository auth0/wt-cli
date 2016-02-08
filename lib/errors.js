exports.cancelled = cancelled;
exports.invalid = invalid;
exports.notFound = notFound;


// Exported interface

function cancelled(message, data) {
    return createError(message, 'E_CANCELLED', data, cancelled);
}

function invalid(message, data) {
    return createError(message, 'E_INVALID', data, invalid);
}

function notFound(message, data) {
    return createError(message, 'E_NOTFOUND', data, notFound);
}


// Private helper functions

function createError(message, code, data, ctor) {
    var error = new Error(message ? message : undefined);
    
    Error.captureStackTrace(error, ctor);
    
    error.code = code;
    error.data = data;
    
    return error;
}