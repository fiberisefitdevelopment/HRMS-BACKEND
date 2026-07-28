const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../constants');

const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);

  if (!result.success) {
    const details = result.error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));

    return next(
      ApiError.badRequest('Validation failed', {
        code: ERROR_CODES.VALIDATION_ERROR,
        errors: details,
      })
    );
  }

  req[source] = result.data;
  next();
};

module.exports = validate;
