const bcrypt = require('bcrypt');
const config = require('../config');

const hashPassword = async (password) => bcrypt.hash(password, config.security.bcryptSaltRounds);

const comparePassword = async (password, hash) => bcrypt.compare(password, hash);

module.exports = {
  hashPassword,
  comparePassword,
};
