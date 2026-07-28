const { randomUUID } = require('crypto');

const requestId = (req, res, next) => {
  req.requestId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

module.exports = requestId;
