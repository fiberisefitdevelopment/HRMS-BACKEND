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

/** Team report user IDs plus the manager's own user ID. */
const getTeamUserIdsIncludingSelf = async (managerUserId, companyId) => {
  const teamUserIds = await getTeamUserIds(managerUserId, companyId);
  const managerKey = managerUserId.toString();
  if (!teamUserIds.some((id) => id.toString() === managerKey)) {
    teamUserIds.push(managerUserId);
  }
  return teamUserIds;
};

const isSelfProfile = (profile, userId) => {
  const profileUserId = profile.userId?._id || profile.userId;
  return profileUserId && profileUserId.toString() === userId.toString();
};

const assertTeamMemberByProfile = (profile, managerUserId) => {
  if (isSelfProfile(profile, managerUserId)) return;

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
  getTeamUserIdsIncludingSelf,
  isSelfProfile,
  assertTeamMemberByProfile,
  assertTeamMemberByProfileId,
  assertTeamMemberByUserId,
};
