const BaseRepository = require('../../shared/base/base.repository');
const User = require('./user.model');

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  findByEmail(email) {
    return User.findOne({ email: email.toLowerCase() });
  }

  findByIdPopulated(id) {
    return User.findById(id)
      .populate('roleId', 'name slug hierarchy')
      .populate('companyId', 'companyName companyCode status')
      .populate('blockedBy', 'firstName lastName email')
      .populate('departmentId', 'name code')
      .populate('designationId', 'name code')
      .populate('managerId', 'firstName lastName email employeeCode');
  }

  findByIdWithRole(id) {
    return User.findById(id).populate('roleId', 'name slug hierarchy');
  }
}

module.exports = new UserRepository();
