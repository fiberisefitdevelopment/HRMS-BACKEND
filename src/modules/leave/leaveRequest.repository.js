const BaseRepository = require('../../shared/base/base.repository');
const LeaveRequest = require('./leaveRequest.model');
const { parsePagination, parseSort, buildPaginationMeta } = require('../../utils/pagination');
const { getDateOnly, datesOverlap } = require('../../utils/time');

class LeaveRequestRepository extends BaseRepository {
  constructor() {
    super(LeaveRequest);
  }

  async findWithFilters(filter, query, options = {}) {
    const { page, limit, skip } = parsePagination(query);
    const sort = parseSort(query.sort, { createdAt: -1 });

    const [data, total] = await Promise.all([
      LeaveRequest.find(filter, null, options)
        .populate('employeeProfileId', 'employeeId departmentId')
        .populate('userId', 'firstName lastName fullName email')
        .populate('departmentId', 'name code')
        .populate('managerId', 'firstName lastName fullName email')
        .populate('rejectedBy', 'firstName lastName fullName email')
        .populate('approvals.approverId', 'firstName lastName fullName email')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      LeaveRequest.countDocuments(filter, options),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  findOverlapping(employeeProfileId, companyId, startDate, endDate, excludeId = null) {
    const rangeStart = getDateOnly(startDate);
    const rangeEnd = getDateOnly(endDate);
    const rangeEndEod = new Date(rangeEnd);
    rangeEndEod.setHours(23, 59, 59, 999);

    const filter = {
      companyId,
      employeeProfileId,
      status: { $in: ['pending', 'approved'] },
      startDate: { $exists: true, $ne: null, $lte: rangeEndEod },
      endDate: { $exists: true, $ne: null, $gte: rangeStart },
    };
    if (excludeId) filter._id = { $ne: excludeId };
    return LeaveRequest.find(filter, null, { companyId });
  }

  findByDateRange(companyId, startDate, endDate, filter = {}) {
    return LeaveRequest.find(
      {
        companyId,
        status: 'approved',
        startDate: { $lte: getDateOnly(endDate) },
        endDate: { $gte: getDateOnly(startDate) },
        ...filter,
      },
      null,
      { companyId }
    )
      .populate('employeeProfileId', 'employeeId departmentId')
      .populate('userId', 'firstName lastName fullName email');
  }

  /** Returns a Query — do not wrap in async so callers can chain/await populate */
  findOneDetailed(filter, options = {}) {
    return LeaveRequest.findOne(filter, null, options)
      .populate('employeeProfileId', 'employeeId departmentId')
      .populate('userId', 'firstName lastName fullName email')
      .populate('departmentId', 'name code')
      .populate('managerId', 'firstName lastName fullName email')
      .populate('rejectedBy', 'firstName lastName fullName email')
      .populate('approvals.approverId', 'firstName lastName fullName email');
  }
}

module.exports = new LeaveRequestRepository();
