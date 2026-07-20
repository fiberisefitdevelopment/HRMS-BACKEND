const EmployeeIdSequence = require('./employeeIdSequence.model');
const Company = require('../companies/company.model');
const ApiError = require('../../utils/ApiError');

const COMPANY_CODE_PREFIXES = {
  FIBERISE: { permanent: 'FR', contractual: 'FRC' },
  VYTALIX: { permanent: 'VMP', contractual: 'VMC' },
};

const getEmploymentCategory = (employmentType) =>
  employmentType === 'contract' ? 'contractual' : 'permanent';

const getSequenceKey = (companyCode, employmentType) =>
  `${companyCode}:${getEmploymentCategory(employmentType)}`;

const getPrefixForCompany = (companyCode, employmentType) => {
  const prefixes = COMPANY_CODE_PREFIXES[companyCode];
  if (!prefixes) throw ApiError.internal(`Employee ID prefixes not configured for ${companyCode}`);
  return prefixes[getEmploymentCategory(employmentType)];
};

const parseSequenceNumber = (employeeCode, prefix) => {
  if (!employeeCode?.startsWith(prefix)) return null;
  const numeric = parseInt(employeeCode.slice(prefix.length), 10);
  return Number.isNaN(numeric) ? null : numeric;
};

const formatEmployeeId = (prefix, number) => `${prefix}${String(number).padStart(4, '0')}`;

const reserveEmployeeId = async ({ companyId, companyCode, employmentType, employeeCode }) => {
  const prefix = getPrefixForCompany(companyCode, employmentType);
  const sequenceKey = getSequenceKey(companyCode, employmentType);
  const requestedNumber = employeeCode ? parseSequenceNumber(employeeCode.toUpperCase(), prefix) : null;

  if (employeeCode && requestedNumber == null) {
    throw ApiError.badRequest(`Invalid employee code format for ${companyCode}: ${employeeCode}`);
  }

  const sequence = await EmployeeIdSequence.findOneAndUpdate(
    { sequenceKey },
    {
      $setOnInsert: { sequenceKey, companyId, prefix },
      ...(requestedNumber != null ? { $max: { lastNumber: requestedNumber } } : { $inc: { lastNumber: 1 } }),
    },
    { new: true, upsert: true }
  );

  if (requestedNumber != null) {
    return employeeCode.toUpperCase();
  }

  return formatEmployeeId(prefix, sequence.lastNumber);
};

const generateEmployeeId = async (companyId, employmentType = 'full_time') => {
  const company = await Company.findById(companyId).select('companyCode');
  if (!company) throw ApiError.notFound('Company not found');
  return reserveEmployeeId({
    companyId,
    companyCode: company.companyCode,
    employmentType,
  });
};

const syncSequenceFromCode = async ({ companyId, companyCode, employmentType, employeeCode }) =>
  reserveEmployeeId({ companyId, companyCode, employmentType, employeeCode });

module.exports = {
  COMPANY_CODE_PREFIXES,
  generateEmployeeId,
  reserveEmployeeId,
  syncSequenceFromCode,
  getPrefixForCompany,
  getSequenceKey,
  formatEmployeeId,
  parseSequenceNumber,
};
