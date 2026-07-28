const jwt = require('jsonwebtoken');
const config = require('./index');
const { AUTH } = require('../constants');

const signAccessToken = (payload) =>
  jwt.sign({ ...payload, type: AUTH.TOKEN_TYPE_ACCESS }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
  });

const signRefreshToken = (payload) =>
  jwt.sign({ ...payload, type: AUTH.TOKEN_TYPE_REFRESH }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });

const verifyAccessToken = (token) => {
  const decoded = jwt.verify(token, config.jwt.accessSecret);
  if (decoded.type !== AUTH.TOKEN_TYPE_ACCESS) {
    throw new Error('Invalid token type');
  }
  return decoded;
};

const verifyRefreshToken = (token) => {
  const decoded = jwt.verify(token, config.jwt.refreshSecret);
  if (decoded.type !== AUTH.TOKEN_TYPE_REFRESH) {
    throw new Error('Invalid token type');
  }
  return decoded;
};

const getRefreshTokenExpiry = () => {
  const match = config.jwt.refreshExpiresIn.match(/^(\d+)([dhms])$/);
  if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return new Date(Date.now() + value * multipliers[unit]);
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
};
