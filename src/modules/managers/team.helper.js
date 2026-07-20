const ApiError = require('../../utils/ApiError');
const EmployeeProfile = require('../employees/employeeProfile.model');
const { SYSTEM_ROLES } = require('../../constants');

const isManagerRole = (requester) => requester?.roleSlug === SYSTEM_ROLES.MANAGER;

const getTeamUserIds = async (managerUserId, companyId) => {
  const profiles = await EmployeeProfile.find({
    companyId,
    managerId: managerUserId,
    isDeleted: false,
  }).select('userId');

  return profiles.map((p) => p.userId);
};

const assertTeamMemberByProfile = (profile, managerUserId) => {
  const managerRef = profile.managerId?._id || profile.managerId;
  if (!managerRef || managerRef.toString() !== managerUserId.toString()) {
    throw ApiError.forbidden('You can only access your team members');
  }
};

const assertTeamMemberByProfileId = async (managerUserId, employeeProfileId, companyId) => {
  const profile = await EmployeeProfile.findOne({ _id: employeeProfileId, companyId, isDeleted: false });
  if (!profile) throw ApiError.notFound('Employee not found');
  assertTeamMemberByProfile(profile, managerUserId);
  return profile;
};

const assertTeamMemberByUserId = async (managerUserId, userId, companyId) => {
  const profile = await EmployeeProfile.findOne({ userId, companyId, isDeleted: false });
  if (!profile) throw ApiError.notFound('Employee not found');
  assertTeamMemberByProfile(profile, managerUserId);
  return profile;
};

module.exports = {
  isManagerRole,
  getTeamUserIds,
  assertTeamMemberByProfile,
  assertTeamMemberByProfileId,
  assertTeamMemberByUserId,
};
