const mongoose = require('mongoose');
const { JsonWebTokenError, TokenExpiredError } = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const { sendFailure } = require('../helpers/response');
const { HTTP_STATUS, ERROR_CODES } = require('../constants');
const { errorLogger } = require('../config/logger');
const config = require('../config');

const handleCastError = (err) =>
  ApiError.badRequest(`Invalid ${err.path}: ${err.value}`, {
    code: ERROR_CODES.VALIDATION_ERROR,
  });

const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue || {})[0] || 'field';
  return ApiError.conflict(`Duplicate value for ${field}`);
};

const handleValidationError = (err) => {
  const details = Object.values(err.errors).map((e) => ({
    field: e.path,
    message: e.message,
  }));
  return ApiError.badRequest('Validation failed', {
    code: ERROR_CODES.VALIDATION_ERROR,
    errors: details,
  });
};

const handleJwtError = (err) => {
  if (err instanceof TokenExpiredError) {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Token expired', ERROR_CODES.TOKEN_EXPIRED);
  }
  if (err instanceof JsonWebTokenError) {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid token', ERROR_CODES.TOKEN_INVALID);
  }
  return ApiError.unauthorized();
};

const isMulterOrMultipartError = (err) => {
  if (!err) return false;
  if (err.name === 'MulterError') return true;
  const message = String(err.message || '');
  return (
    message.includes('Unexpected end of form') ||
    message.includes('Unexpected field') ||
    message.includes('Multipart') ||
    message.includes('File too large')
  );
};

const handleMulterError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return ApiError.badRequest('File is too large');
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return ApiError.badRequest(`Unexpected file field: ${err.field || 'unknown'}`);
  }
  if (String(err.message || '').includes('Unexpected end of form')) {
    return ApiError.badRequest(
      'Invalid multipart upload. Send FormData with field "photo" and do not set Content-Type manually.'
    );
  }
  return ApiError.badRequest(err.message || 'File upload failed');
};

const errorHandler = (err, req, res, next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    if (error instanceof mongoose.Error.CastError) {
      error = handleCastError(error);
    } else if (error.code === 11000) {
      error = handleDuplicateKeyError(error);
    } else if (error instanceof mongoose.Error.ValidationError) {
      error = handleValidationError(error);
    } else if (error instanceof JsonWebTokenError || error instanceof TokenExpiredError) {
      error = handleJwtError(error);
    } else if (isMulterOrMultipartError(error)) {
      error = handleMulterError(error);
    } else {
      error = ApiError.internal(
        config.isProduction ? 'Something went wrong' : error.message
      );
    }
  }

  errorLogger.error(error.message, {
    requestId: req.requestId,
    statusCode: error.statusCode,
    errorCode: error.errorCode,
    path: req.originalUrl,
    method: req.method,
    stack: config.isDevelopment ? error.stack : undefined,
  });

  const payload = {
    message: error.message,
    statusCode: error.statusCode,
  };

  if (error.errorCode || error.details) {
    payload.error = {
      code: error.errorCode,
      ...(error.details && { details: error.details }),
    };
  }

  if (!config.isProduction && error.stack && !(error instanceof ApiError)) {
    payload.error = { ...(payload.error || {}), stack: error.stack };
  }

  return sendFailure(res, payload);
};

module.exports = errorHandler;
