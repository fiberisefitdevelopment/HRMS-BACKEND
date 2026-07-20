const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const Company = require('../modules/companies/company.model');
const catchAsync = require('../utils/catchAsync');
const { authenticate } = require('./auth.middleware');
const { requireCompanyContext, attachCompanyScope } = require('./companyContext.middleware');

/**
 * Resolves company scope for public (unauthenticated) GET endpoints.
 * Requires query: companyId (ObjectId) OR companyCode (e.g. FIBERISE).
 */
const resolvePublicCompany = catchAsync(async (req, res, next) => {
  const { companyId, companyCode } = req.query;

  if (!companyId && !companyCode) {
    throw ApiError.badRequest('companyId or companyCode query parameter is required');
  }

  let company = null;

  if (companyId) {
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      throw ApiError.badRequest('Invalid companyId');
    }
    company = await Company.findById(companyId);
  } else {
    company = await Company.findOne({ companyCode: String(companyCode).toUpperCase() });
  }

  if (!company || company.status !== 'active') {
    throw ApiError.notFound('Company not found');
  }

  req.companyId = company._id;
  req.publicCompany = company;
  next();
});

/**
 * If Authorization Bearer is present → authenticate + company from token.
 * Otherwise → resolve company from ?companyId= or ?companyCode= (no auth).
 */
const optionalAuthOrPublicCompany = (req, res, next) => {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return authenticate(req, res, (err) => {
      if (err) return next(err);
      return requireCompanyContext(req, res, (err2) => {
        if (err2) return next(err2);
        return attachCompanyScope(req, res, next);
      });
    });
  }

  return resolvePublicCompany(req, res, (err) => {
    if (err) return next(err);
    return attachCompanyScope(req, res, next);
  });
};

module.exports = { resolvePublicCompany, optionalAuthOrPublicCompany };
