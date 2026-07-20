const BaseRepository = require('../../shared/base/base.repository');
const RegularizationRequest = require('./regularizationRequest.model');
const { parsePagination, parseSort, buildPaginationMeta } = require('../../utils/pagination');
const { getDateOnly, getMonthYear } = require('../../utils/time');

class RegularizationRequestRepository extends BaseRepository {
  constructor() {
    super(RegularizationRequest);
  }

  findActiveForDate(employeeProfileId, companyId, attendanceDate) {
    return this.model.findOne(
      {
        companyId,
        employeeProfileId,
        attendanceDate: getDateOnly(attendanceDate),
        status: { $in: ['pending', 'approved'] },
      },
      null,
      { companyId }
    );
  }

  countUsedInMonth(employeeProfileId, companyId, date) {
    const { year, month } = getMonthYear(date);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);

    return this.model.countDocuments(
      {
        companyId,
        employeeProfileId,
        status: { $in: ['pending', 'approved'] },
        attendanceDate: { $gte: monthStart, $lt: monthEnd },
      },
      { companyId }
    );
  }

  async findWithFilters(filter, query, options = {}) {
    const { page, limit, skip } = parsePagination(query);
    const sort = parseSort(query.sort, { createdAt: -1 });

    const [data, total] = await Promise.all([
      RegularizationRequest.find(filter, null, options)
        .populate('employeeProfileId', 'employeeId departmentId')
        .populate('userId', 'firstName lastName fullName email')
        .populate('managerId', 'firstName lastName fullName email')
        .populate('approvedBy', 'firstName lastName fullName email')
        .populate('rejectedBy', 'firstName lastName fullName email')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      RegularizationRequest.countDocuments(filter, options),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }
}

module.exports = new RegularizationRequestRepository();
