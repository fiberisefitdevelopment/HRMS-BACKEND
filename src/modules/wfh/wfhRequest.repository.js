const BaseRepository = require('../../shared/base/base.repository');
const WfhRequest = require('./wfhRequest.model');
const { parsePagination, parseSort, buildPaginationMeta } = require('../../utils/pagination');
const { getDateOnly } = require('../../utils/time');

class WfhRequestRepository extends BaseRepository {
  constructor() {
    super(WfhRequest);
  }

  findActiveForDate(employeeProfileId, companyId, date) {
    return this.model.findOne(
      {
        companyId,
        employeeProfileId,
        date: getDateOnly(date),
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
      WfhRequest.find(filter, null, options)
        .populate('employeeProfileId', 'employeeId departmentId')
        .populate('userId', 'firstName lastName fullName email')
        .populate('managerId', 'firstName lastName fullName email')
        .populate('approvedBy', 'firstName lastName fullName email')
        .populate('rejectedBy', 'firstName lastName fullName email')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      WfhRequest.countDocuments(filter, options),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }
}

module.exports = new WfhRequestRepository();
