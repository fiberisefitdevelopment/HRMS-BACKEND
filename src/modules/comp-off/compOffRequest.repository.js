const BaseRepository = require('../../shared/base/base.repository');
const CompOffRequest = require('./compOffRequest.model');
const { parsePagination, parseSort, buildPaginationMeta } = require('../../utils/pagination');
const { getDateOnly } = require('../../utils/time');

class CompOffRequestRepository extends BaseRepository {
  constructor() {
    super(CompOffRequest);
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

  async findWithFilters(filter, query, options = {}) {
    const { page, limit, skip } = parsePagination(query);
    const sort = parseSort(query.sort, { createdAt: -1 });

    const [data, total] = await Promise.all([
      CompOffRequest.find(filter, null, options)
        .populate('employeeProfileId', 'employeeId departmentId')
        .populate('userId', 'firstName lastName fullName email')
        .populate('managerId', 'firstName lastName fullName email')
        .populate('approvedBy', 'firstName lastName fullName email')
        .populate('rejectedBy', 'firstName lastName fullName email')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      CompOffRequest.countDocuments(filter, options),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }
}

module.exports = new CompOffRequestRepository();
