const EmployeeProfile = require('../employees/employeeProfile.model');
const ApiError = require('../../utils/ApiError');

const getEmployeeProfileByUser = async (userId, companyId) => {
  const profile = await EmployeeProfile.findOne(
    { userId, companyId, isDeleted: false },
    null,
    { companyId }
  );
  if (!profile) throw ApiError.notFound('Employee profile not found');
  return profile;
};

module.exports = { getEmployeeProfileByUser };
