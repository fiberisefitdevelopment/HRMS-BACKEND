const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../constants');

/**
 * Ensures company context is set on the request.
 * Will be populated by auth middleware once authentication is implemented.
 */
const requireCompanyContext = (req, res, next) => {
  if (!req.companyId) {
    return next(
      new ApiError(403, 'Company context is required', ERROR_CODES.COMPANY_CONTEXT_REQUIRED)
    );
  }
  next();
};

/**
 * Attaches companyId to Mongoose query options for repository-level isolation.
 */
const attachCompanyScope = (req, res, next) => {
  if (req.companyId) {
    req.queryOptions = { ...(req.queryOptions || {}), companyId: req.companyId };
  }
  next();
};

module.exports = {
  requireCompanyContext,
  attachCompanyScope,
};
