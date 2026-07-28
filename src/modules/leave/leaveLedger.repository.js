const BaseRepository = require('../../shared/base/base.repository');
const LeaveLedger = require('./leaveLedger.model');
const { parsePagination, parseSort, buildPaginationMeta } = require('../../utils/pagination');

class LeaveLedgerRepository extends BaseRepository {
  constructor() {
    super(LeaveLedger);
  }

  async findByEmployee(employeeProfileId, companyId, query = {}) {
    const { page, limit, skip } = parsePagination(query);
    const sort = parseSort(query.sort, { transactionDate: -1 });
    const filter = { companyId, employeeProfileId };
    if (query.leaveTypeCode) filter.leaveTypeCode = query.leaveTypeCode.toUpperCase();

    const [data, total] = await Promise.all([
      LeaveLedger.find(filter, null, { companyId }).sort(sort).skip(skip).limit(limit),
      LeaveLedger.countDocuments(filter, { companyId }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }
}

module.exports = new LeaveLedgerRepository();
