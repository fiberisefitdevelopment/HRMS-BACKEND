const crypto = require('crypto');
const ApiError = require('../../utils/ApiError');
const { hashPassword } = require('../../helpers/password');
const { createAuditLog } = require('../../helpers/audit');
const { SYSTEM_ROLES } = require('../../constants');
const User = require('../users/user.model');
const Role = require('../roles/role.model');
const employeeRepository = require('./employee.repository');
const EmployeeProfile = require('./employeeProfile.model');
const EmployeeShiftAssignment = require('../shifts/employeeShiftAssignment.model');
const { generateEmployeeId } = require('./employeeId.generator');
const shiftService = require('../shifts/shift.service');

const getActiveShiftId = async (employeeProfileId, companyId) => {
  const assignment = await EmployeeShiftAssignment.findOne(
    { employeeProfileId, companyId, isActive: true },
    null,
    { companyId }
  ).select('shiftId');
  return assignment?.shiftId?.toString() ?? null;
};

const formatRole = (roleId) => {
  if (!roleId) return null;
  if (typeof roleId === 'object' && roleId.slug) {
    return {
      id: roleId._id ?? roleId.id ?? null,
      name: roleId.name || null,
      slug: roleId.slug,
    };
  }
  return null;
};

const formatEmployee = (profile, shiftId = null) => {
  if (!profile) return null;
  const user = profile.userId;
  const role = formatRole(user?.roleId);
  return {
    id: profile._id,
    userId: user?._id || profile.userId,
    employeeId: profile.employeeId,
    shiftId,
    firstName: user?.firstName,
    lastName: user?.lastName,
    fullName: user?.fullName,
    email: user?.email,
    officialEmail: profile.officialEmail,
    personalEmail: profile.personalEmail,
    phone: profile.phone || user?.phone,
    role,
    roleSlug: role?.slug || null,
    company: profile.companyId,
    department: profile.departmentId,
    designation: profile.designationId,
    manager: profile.managerId,
    joiningDate: profile.joiningDate,
    confirmationDate: profile.confirmationDate,
    employmentType: profile.employmentType,
    workLocation: profile.workLocation,
    officeLocation: profile.officeLocation,
    gender: profile.gender,
    dateOfBirth: profile.dateOfBirth,
    maritalStatus: profile.maritalStatus,
    nationality: profile.nationality,
    bloodGroup: profile.bloodGroup,
    alternatePhone: profile.alternatePhone,
    emergencyContactName: profile.emergencyContactName,
    emergencyContactNumber: profile.emergencyContactNumber,
    relation: profile.relation,
    address: profile.address,
    city: profile.city,
    state: profile.state,
    country: profile.country,
    pincode: profile.pincode,
    bankName: profile.bankName,
    ifscCode: profile.ifscCode,
    uan: profile.uan,
    pfNumber: profile.pfNumber,
    esiNumber: profile.esiNumber,
    profilePhoto: profile.profilePhoto,
    status: profile.status,
    isActive: user?.isActive,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
};

const getRoleBySlug = async (slug) => {
  const role = await Role.findOne({ slug, isSystem: true });
  if (!role) throw ApiError.internal(`Role ${slug} not found`);
  return role;
};

const validateManager = async (managerId, companyId) => {
  if (!managerId) return null;

  // Prefer User id (canonical). Also accept EmployeeProfile id from older UIs.
  let manager = await User.findOne({ _id: managerId, companyId }).populate('roleId', 'slug');

  if (!manager) {
    const profile = await EmployeeProfile.findOne(
      { _id: managerId, companyId, isDeleted: false },
      null,
      { companyId }
    );
    if (profile?.userId) {
      manager = await User.findOne({ _id: profile.userId, companyId }).populate('roleId', 'slug');
    }
  }

  if (!manager) throw ApiError.badRequest('Manager not found in this company');
  if (![SYSTEM_ROLES.MANAGER, SYSTEM_ROLES.HR, SYSTEM_ROLES.OWNER].includes(manager.roleId?.slug)) {
    throw ApiError.badRequest('Assigned manager must have manager, HR, or owner role');
  }
  return manager._id;
};

const syncEmployeeUserManager = async (employeeUserId, managerUserId) => {
  if (!employeeUserId) return;
  await User.findByIdAndUpdate(employeeUserId, { managerId: managerUserId || null });
};

const createEmployee = async (data, companyId, actorId, req) => {
  const emailExists = await User.findOne({ email: data.officialEmail.toLowerCase() });
  if (emailExists) throw ApiError.conflict('Official email already registered');

  const profileEmailExists = await employeeRepository.findOne(
    { companyId, officialEmail: data.officialEmail.toLowerCase() },
    null,
    { companyId }
  );
  if (profileEmailExists) throw ApiError.conflict('Official email already exists in this company');

  const resolvedManagerId = data.managerId
    ? await validateManager(data.managerId, companyId)
    : null;

  const role = await getRoleBySlug(data.roleSlug || SYSTEM_ROLES.EMPLOYEE);
  const employeeId = await generateEmployeeId(companyId, data.employmentType || 'full_time');
  const tempPassword = data.password || `Temp@${crypto.randomBytes(4).toString('hex')}`;
  const hashedPassword = await hashPassword(tempPassword);

  let user;
  try {
    user = await User.create({
      employeeCode: employeeId,
      firstName: data.firstName,
      lastName: data.lastName || '',
      email: data.officialEmail.toLowerCase(),
      phone: data.phone,
      password: hashedPassword,
      roleId: role._id,
      companyId,
      managerId: resolvedManagerId,
      createdBy: actorId,
      updatedBy: actorId,
      isActive: true,
      status: 'active',
    });

    const { shiftId, ...profileData } = { ...data };
    delete profileData.firstName;
    delete profileData.lastName;
    delete profileData.password;
    delete profileData.roleSlug;
    profileData.managerId = resolvedManagerId;

    const profile = await EmployeeProfile.create({
      ...profileData,
      userId: user._id,
      companyId,
      employeeId,
      officialEmail: data.officialEmail.toLowerCase(),
      createdBy: actorId,
      updatedBy: actorId,
      status: 'active',
    });

    if (shiftId) {
      await shiftService.assignShift(
        { employeeProfileId: profile._id, userId: user._id, shiftId },
        companyId,
        actorId,
        req
      );
    }

    const { initializeLeaveBalances } = require('../leave/helpers/balanceInit.helper');
    await initializeLeaveBalances(profile, user._id, companyId, {
      skipExisting: false,
      reason: 'Initial leave balance on employee creation',
    });

    const populated = await employeeRepository.findByIdWithDetails(profile._id, companyId);
    const activeShiftId = shiftId ? shiftId.toString() : await getActiveShiftId(profile._id, companyId);

    await createAuditLog({
      companyId,
      userId: actorId,
      action: 'create',
      entityType: 'employee',
      entityId: profile._id,
      changes: { after: { employeeId, email: data.officialEmail } },
      req,
    });

    return {
      ...formatEmployee(populated, activeShiftId),
      temporaryPassword: data.password ? undefined : tempPassword,
    };
  } catch (error) {
    if (user?._id) await User.findByIdAndDelete(user._id);
    throw error;
  }
};

const updateEmployee = async (id, data, companyId, actorId, req, options = {}) => {
  const profile = await employeeRepository.findByIdWithDetails(id, companyId);
  if (!profile) throw ApiError.notFound('Employee not found');

  if (options.selfOnly && profile.userId._id.toString() !== actorId.toString()) {
    throw ApiError.forbidden('You can only update your own profile');
  }

  if (options.managerTeamOnly) {
    if (profile.managerId?._id?.toString() !== actorId.toString()) {
      throw ApiError.forbidden('You can only update your team members');
    }
  }

  if (data.managerId !== undefined) {
    data.managerId = data.managerId
      ? await validateManager(data.managerId, companyId)
      : null;
  }

  const userUpdate = {};
  if (data.firstName) userUpdate.firstName = data.firstName;
  if (data.lastName !== undefined) userUpdate.lastName = data.lastName;
  if (data.phone) userUpdate.phone = data.phone;
  if (data.managerId !== undefined) userUpdate.managerId = data.managerId;
  if (Object.keys(userUpdate).length) {
    userUpdate.updatedBy = actorId;
    await User.findByIdAndUpdate(profile.userId._id, userUpdate);
  }

  const { shiftId, ...profileUpdate } = { ...data };
  delete profileUpdate.firstName;
  delete profileUpdate.lastName;
  delete profileUpdate.employeeId;
  delete profileUpdate.employeeCode;
  profileUpdate.updatedBy = actorId;

  await employeeRepository.updateById(id, profileUpdate, { companyId });

  if (shiftId !== undefined) {
    if (shiftId) {
      await shiftService.assignShift(
        { employeeProfileId: id, userId: profile.userId._id, shiftId },
        companyId,
        actorId,
        req
      );
    } else {
      await shiftService.removeShiftAssignment(id, companyId, actorId, req);
    }
  }

  const updated = await employeeRepository.findByIdWithDetails(id, companyId);
  const activeShiftId = await getActiveShiftId(id, companyId);

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'update',
    entityType: 'employee',
    entityId: id,
    req,
  });

  return formatEmployee(updated, activeShiftId);
};

const getEmployee = async (id, companyId, requester) => {
  const profile = await employeeRepository.findByIdWithDetails(id, companyId);
  if (!profile) throw ApiError.notFound('Employee not found');

  const { isManagerRole, assertTeamMemberByProfile } = require('../managers/team.helper');
  if (requester && isManagerRole(requester)) {
    assertTeamMemberByProfile(profile, requester.id);
  }

  const shiftId = await getActiveShiftId(profile._id, companyId);
  return formatEmployee(profile, shiftId);
};

const getMyProfile = async (userId, companyId) => {
  const profile = await employeeRepository.findByUserId(userId, companyId);
  if (!profile) throw ApiError.notFound('Employee profile not found');
  
  const assignment = await EmployeeShiftAssignment.findOne(
    { employeeProfileId: profile._id, companyId, isActive: true },
    null,
    { companyId }
  ).populate('shiftId');
  
  const shift = assignment?.shiftId || null;
  const shiftId = shift?._id ?? null;
  const formatted = formatEmployee(profile, shiftId);

  // Fetch policy to evaluate geofencing status
  const policyEngine = require('../attendance/engines/policy.engine');
  let geofencingEnabled = false;
  try {
    const policy = await policyEngine.getPolicyForCompany(companyId);
    const geofencing = policy.geofencing || {};
    if (geofencing.enabled) {
      const applyToAll = geofencing.applyToAllEmployees !== false;
      if (applyToAll) {
        geofencingEnabled = true;
      } else {
        const allowedIds = (geofencing.employeeProfileIds || []).map((id) => String(id));
        geofencingEnabled = allowedIds.includes(String(profile._id));
      }
    }
  } catch (err) {
    // Ignore policy configuration error
  }

  const departmentName =
    profile.departmentId?.name ||
    (typeof profile.departmentId === 'string' ? profile.departmentId : null);
  const designationName =
    profile.designationId?.name ||
    (typeof profile.designationId === 'string' ? profile.designationId : null);
  const managerName = profile.managerId
    ? [profile.managerId.firstName, profile.managerId.lastName].filter(Boolean).join(' ') ||
      profile.managerId.fullName ||
      null
    : null;
  const managerId = profile.managerId?._id || profile.managerId || null;

  return {
    ...formatted,
    geofencing: geofencingEnabled,
    department: departmentName,
    departmentName,
    designation: designationName,
    designationName,
    shiftTime: shift ? `${shift.startTime} - ${shift.endTime}` : null,
    workingDays: shift?.workingDays || [],
    role: formatted.role,
    roleSlug: formatted.roleSlug,
    managerName,
    managerId,
    gender: profile.gender || null,
    dateOfBirth: profile.dateOfBirth || null,
    dob: profile.dateOfBirth || null,
    maritalStatus: profile.maritalStatus || null,
    address: profile.address || null,
    phone: profile.phone || profile.userId?.phone || null,
    emergencyContact: {
      name: profile.emergencyContactName || null,
      number: profile.emergencyContactNumber || null,
      relation: profile.relation || null,
    },
  };
};

const listEmployees = async (companyId, query, requester) => {
  const filter = { companyId, isDeleted: false };

  const { isManagerRole } = require('../managers/team.helper');
  if (requester && isManagerRole(requester)) {
    filter.managerId = requester.id;
  } else if (query.managerId) {
    filter.managerId = query.managerId;
  }

  if (query.departmentId) filter.departmentId = query.departmentId;
  if (query.designationId) filter.designationId = query.designationId;
  if (query.employmentCategory === 'contractual') {
    filter.employmentType = 'contract';
  } else if (query.employmentCategory === 'permanent') {
    filter.employmentType = { $ne: 'contract' };
  } else if (query.employmentType) {
    filter.employmentType = query.employmentType;
  }
  if (query.status) filter.status = query.status;

  if (query.joiningDateFrom || query.joiningDateTo) {
    filter.joiningDate = {};
    if (query.joiningDateFrom) filter.joiningDate.$gte = new Date(query.joiningDateFrom);
    if (query.joiningDateTo) filter.joiningDate.$lte = new Date(query.joiningDateTo);
  }

  if (query.search) {
    const regex = { $regex: query.search, $options: 'i' };
    const matchingUsers = await User.find({
      companyId,
      $or: [{ firstName: regex }, { lastName: regex }, { fullName: regex }, { email: regex }],
    }).select('_id');
    filter.$or = [
      { employeeId: regex },
      { officialEmail: regex },
      { phone: regex },
      { userId: { $in: matchingUsers.map((u) => u._id) } },
    ];
  }

  const result = await employeeRepository.findWithUser(filter, query, { companyId });
  return { data: result.data.map(formatEmployee), meta: result.meta };
};

const setEmployeeStatus = async (id, status, companyId, actorId, req, userActive = true) => {
  const profile = await employeeRepository.findByIdWithDetails(id, companyId);
  if (!profile) throw ApiError.notFound('Employee not found');

  await employeeRepository.updateById(id, { status, updatedBy: actorId }, { companyId });
  await User.findByIdAndUpdate(profile.userId._id, {
    isActive: userActive,
    status: userActive ? 'active' : 'inactive',
    ...(userActive
      ? { failedLoginAttempts: 0, lockedUntil: null, isBlocked: false, blockedBy: null, blockedReason: null, blockedAt: null }
      : {}),
    updatedBy: actorId,
  });

  await createAuditLog({
    companyId,
    userId: actorId,
    action: userActive ? 'activate' : 'update',
    entityType: 'employee',
    entityId: id,
    changes: { after: { status } },
    req,
  });

  return getEmployee(id, companyId);
};

const softDeleteEmployee = async (id, companyId, actorId, req) => {
  const profile = await employeeRepository.findByIdWithDetails(id, companyId);
  if (!profile) throw ApiError.notFound('Employee not found');

  throw ApiError.badRequest(
    'Employee records cannot be deleted. Assigned employee codes are permanent — block access instead.'
  );
};

const blockEmployeeAccess = async (id, companyId, actorId, req, reason) => {
  const profile = await employeeRepository.findByIdWithDetails(id, companyId);
  if (!profile) throw ApiError.notFound('Employee not found');

  await User.findByIdAndUpdate(profile.userId._id, {
    isBlocked: true,
    isActive: false,
    status: 'inactive',
    blockedBy: actorId,
    blockedReason: reason || 'Access blocked by administrator',
    blockedAt: new Date(),
    updatedBy: actorId,
  });

  await employeeRepository.updateById(
    id,
    { status: 'inactive', updatedBy: actorId },
    { companyId }
  );

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'block',
    entityType: 'employee',
    entityId: id,
    metadata: { employeeId: profile.employeeId, reason },
    req,
  });

  return getEmployee(id, companyId);
};

const bulkUpdate = async (employeeIds, updateData, companyId, actorId, req, action) => {
  const results = { success: 0, failed: 0, errors: [] };
  const payload = { ...updateData };

  if (action === 'bulk_manager_assignment' && payload.managerId) {
    payload.managerId = await validateManager(payload.managerId, companyId);
  }

  for (const id of employeeIds) {
    try {
      const profile = await employeeRepository.findOne(
        { _id: id, companyId, isDeleted: false },
        null,
        { companyId }
      );
      if (!profile) {
        results.failed += 1;
        results.errors.push({ id, message: 'Employee not found' });
        continue;
      }

      const updated = await employeeRepository.updateById(
        id,
        { ...payload, updatedBy: actorId },
        { companyId }
      );
      if (!updated) {
        results.failed += 1;
        results.errors.push({ id, message: 'Update failed' });
        continue;
      }

      if (action === 'bulk_manager_assignment') {
        await syncEmployeeUserManager(profile.userId, payload.managerId ?? null);
      }

      // Activating an employee should also clear temporary login lockouts
      if (action === 'bulk_activate' && profile.userId) {
        await User.findByIdAndUpdate(profile.userId, {
          isActive: true,
          status: 'active',
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedBy: actorId,
        });
      }

      if (action === 'bulk_deactivate' && profile.userId) {
        await User.findByIdAndUpdate(profile.userId, {
          isActive: false,
          status: 'inactive',
          updatedBy: actorId,
        });
      }

      results.success += 1;
    } catch (error) {
      results.failed += 1;
      results.errors.push({ id, message: error.message || 'Update failed' });
    }
  }

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'update',
    entityType: 'employee',
    metadata: { bulkAction: action, success: results.success, failed: results.failed, count: employeeIds.length },
    req,
  });

  return results;
};

const uploadProfilePhoto = async (id, filename, companyId, actorId, req) => {
  const profile = await employeeRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!profile) throw ApiError.notFound('Employee not found');

  const photoUrl = `/uploads/photos/${filename}`;
  await employeeRepository.updateById(id, { profilePhoto: photoUrl, updatedBy: actorId }, { companyId });

  const userId = profile.userId?._id || profile.userId;
  if (userId) {
    await User.findByIdAndUpdate(userId, { profilePhoto: photoUrl });
  }

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'update',
    entityType: 'employee',
    entityId: id,
    metadata: { action: 'profile_photo_upload' },
    req,
  });

  return { profilePhoto: photoUrl };
};

const uploadMyProfilePhoto = async (userId, filename, companyId, req) => {
  const profile = await employeeRepository.findByUserId(userId, companyId);
  if (!profile) throw ApiError.notFound('Employee profile not found');
  return uploadProfilePhoto(profile._id, filename, companyId, userId, req);
};

const removeProfilePhoto = async (id, companyId, actorId, req) => {
  const profile = await employeeRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!profile) throw ApiError.notFound('Employee not found');

  await employeeRepository.updateById(id, { profilePhoto: null, updatedBy: actorId }, { companyId });

  const userId = profile.userId?._id || profile.userId;
  if (userId) {
    await User.findByIdAndUpdate(userId, { profilePhoto: null });
  }

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'update',
    entityType: 'employee',
    entityId: id,
    metadata: { action: 'profile_photo_delete' },
    req,
  });
};

const removeMyProfilePhoto = async (userId, companyId, req) => {
  const profile = await employeeRepository.findByUserId(userId, companyId);
  if (!profile) throw ApiError.notFound('Employee profile not found');
  return removeProfilePhoto(profile._id, companyId, userId, req);
};

const getProfilePhotoUrlForUser = async (userId, companyId) => {
  const profile = await employeeRepository.findByUserId(userId, companyId);
  if (profile?.profilePhoto) return profile.profilePhoto;

  const user = await User.findById(userId).select('profilePhoto');
  return user?.profilePhoto || null;
};

const getProfilePhotoUrl = async (id, companyId) => {
  const profile = await employeeRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!profile?.profilePhoto) return null;
  return profile.profilePhoto;
};

module.exports = {
  formatEmployee,
  createEmployee,
  updateEmployee,
  getEmployee,
  getMyProfile,
  listEmployees,
  activateEmployee: (id, companyId, actorId, req) =>
    setEmployeeStatus(id, 'active', companyId, actorId, req, true),
  deactivateEmployee: (id, companyId, actorId, req) =>
    setEmployeeStatus(id, 'inactive', companyId, actorId, req, false),
  deleteEmployee: softDeleteEmployee,
  bulkUpdate,
  uploadProfilePhoto,
  uploadMyProfilePhoto,
  removeProfilePhoto,
  removeMyProfilePhoto,
  getProfilePhotoUrlForUser,
  getProfilePhotoUrl,
  validateManager,
  getRoleBySlug,
};
