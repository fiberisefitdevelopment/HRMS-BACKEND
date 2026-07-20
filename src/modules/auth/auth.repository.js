const BaseRepository = require('../../shared/base/base.repository');
const Session = require('./session.model');
const User = require('../users/user.model');
const EmployeeProfile = require('../employees/employeeProfile.model');

const userAuthPopulate = [
  {
    path: 'roleId',
    select: 'name slug permissions hierarchy isSystem',
    populate: { path: 'permissions', select: 'slug' },
  },
  { path: 'companyId', select: 'companyName companyCode status logo' },
];

class AuthRepository extends BaseRepository {
  constructor() {
    super(Session);
  }

  findUserByEmail(email) {
    return User.findOne({ email: email.toLowerCase() })
      .select('+password')
      .populate(userAuthPopulate);
  }

  async findUserByEmployeeCode(employeeCode) {
    const normalized = employeeCode.toUpperCase().trim();

    let user = await User.findOne({ employeeCode: normalized })
      .select('+password')
      .populate(userAuthPopulate);

    if (user) return user;

    // Fallback: resolve via employee profile (legacy users may lack user.employeeCode).
    const profile = await EmployeeProfile.findOne({
      employeeId: normalized,
      isDeleted: false,
    }).select('userId');

    if (!profile?.userId) return null;

    return User.findById(profile.userId).select('+password').populate(userAuthPopulate);
  }

  findUserById(id) {
    return User.findById(id)
      .populate({
        path: 'roleId',
        select: 'name slug permissions hierarchy isSystem',
        populate: { path: 'permissions', select: 'slug name module action' },
      })
      .populate('companyId', 'companyName companyCode status logo')
      .populate('blockedBy', 'firstName lastName email');
  }

  findUserByIdWithPassword(id) {
    return User.findById(id).select('+password').populate('roleId', 'name slug permissions');
  }

  updateUser(id, data) {
    return User.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  createSession(data) {
    return Session.create(data);
  }

  findSessionById(id) {
    return Session.findById(id).select('+refreshTokenHash');
  }

  findActiveSession(userId, refreshTokenHash) {
    return Session.findOne({
      userId,
      refreshTokenHash,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    }).select('+refreshTokenHash');
  }

  revokeSession(sessionId) {
    return Session.findByIdAndUpdate(sessionId, {
      isRevoked: true,
      revokedAt: new Date(),
    });
  }

  revokeAllUserSessions(userId) {
    return Session.updateMany(
      { userId, isRevoked: false },
      { isRevoked: true, revokedAt: new Date() }
    );
  }

  updateSession(sessionId, data) {
    return Session.findByIdAndUpdate(sessionId, data, { new: true });
  }
}

module.exports = new AuthRepository();
