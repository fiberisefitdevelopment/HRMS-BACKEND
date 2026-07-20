const { PASSWORD_REGEX } = require('../constants');

const PASSWORD_REQUIREMENTS =
  'Password must be at least 8 characters with uppercase, lowercase, number, and special character';

const validatePasswordStrength = (password) => PASSWORD_REGEX.test(password);

const getPasswordValidationMessage = () => PASSWORD_REQUIREMENTS;

module.exports = {
  validatePasswordStrength,
  getPasswordValidationMessage,
  PASSWORD_REQUIREMENTS,
};
