const BaseRepository = require('../../shared/base/base.repository');
const LeaveBalance = require('./leaveBalance.model');

class LeaveBalanceRepository extends BaseRepository {
  constructor() {
    super(LeaveBalance);
  }

  findByEmployee(employeeProfileId, companyId) {
    return LeaveBalance.find({ companyId, employeeProfileId }, null, { companyId });
  }

  findOneByType(employeeProfileId, companyId, leaveTypeCode) {
    return LeaveBalance.findOne(
      { companyId, employeeProfileId, leaveTypeCode: leaveTypeCode.toUpperCase() },
      null,
      { companyId }
    );
  }

  findByCompany(companyId, query = {}) {
    const filter = { companyId };
    if (query.leaveTypeCode) filter.leaveTypeCode = query.leaveTypeCode.toUpperCase();
    if (query.departmentId) {
      // populated via aggregation in report service
    }
    return LeaveBalance.find(filter, null, { companyId })
      .populate('employeeProfileId', 'employeeId userId departmentId')
      .populate('userId', 'firstName lastName fullName email');
  }
}

module.exports = new LeaveBalanceRepository();
