const { HTTP_STATUS } = require('../constants');

const sendSuccess = (res, { message = 'Success', data = null, meta = null, statusCode = HTTP_STATUS.OK } = {}) => {
  const response = { success: true, message };
  if (data !== null) response.data = data;
  if (meta !== null) response.meta = meta;
  return res.status(statusCode).json(response);
};

const sendCreated = (res, { message = 'Created successfully', data = null, meta = null } = {}) =>
  sendSuccess(res, { message, data, meta, statusCode: HTTP_STATUS.CREATED });

const sendFailure = (res, { message, error = null, statusCode = HTTP_STATUS.BAD_REQUEST } = {}) => {
  const response = { success: false, message };
  if (error !== null) response.error = error;
  return res.status(statusCode).json(response);
};

module.exports = {
  sendSuccess,
  sendCreated,
  sendFailure,
};
