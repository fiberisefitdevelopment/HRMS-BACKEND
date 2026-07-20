const BaseRepository = require('../../shared/base/base.repository');
const Model = require('./auditLog.model');
const { parsePagination, parseSort, buildPaginationMeta } = require('../../utils/pagination');

class AuditLogRepository extends BaseRepository {
  constructor() {
    super(Model);
  }

  async findWithFilters(filter, query = {}, options = {}) {
    const { page, limit, skip } = parsePagination(query);
    const sort = parseSort(query.sort || '-createdAt');
    const queryOptions = { ...options };
    if (options.companyId) queryOptions.companyId = options.companyId;

    const [data, total] = await Promise.all([
      this.model
        .find(filter, null, queryOptions)
        .populate('userId', 'firstName lastName fullName email')
        .populate('subjectUserId', 'firstName lastName fullName email')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.model.countDocuments(filter, queryOptions),
    ]);

    return {
      data,
      meta: buildPaginationMeta(total, page, limit),
    };
  }
}

module.exports = new AuditLogRepository();
