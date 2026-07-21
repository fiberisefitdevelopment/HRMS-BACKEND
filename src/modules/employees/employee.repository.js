const BaseRepository = require('../../shared/base/base.repository');
const EmployeeProfile = require('./employeeProfile.model');
const { parsePagination, parseSort, buildPaginationMeta } = require('../../utils/pagination');

class EmployeeRepository extends BaseRepository {
  constructor() {
    super(EmployeeProfile);
  }

  findWithUser(filter, query, options = {}) {
    const { page, limit, skip } = parsePagination(query);
    const sort = parseSort(query.sort, { createdAt: -1 });
    const queryOptions = { ...options };
    if (options.companyId) queryOptions.companyId = options.companyId;

    const q = EmployeeProfile.find({ ...filter, isDeleted: false }, null, queryOptions)
      .populate({
        path: 'userId',
        select: 'firstName lastName fullName email phone isActive status roleId',
        populate: { path: 'roleId', select: 'name slug' },
      })
      .populate('departmentId', 'name code')
      .populate('designationId', 'name code')
      .populate('managerId', 'firstName lastName fullName email')
      .populate('companyId', 'companyName companyCode')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    return Promise.all([
      q,
      EmployeeProfile.countDocuments({ ...filter, isDeleted: false }, queryOptions),
    ]).then(([data, total]) => ({
      data,
      meta: buildPaginationMeta(total, page, limit),
    }));
  }

  findByIdWithDetails(id, companyId) {
    return EmployeeProfile.findOne({ _id: id, companyId, isDeleted: false }, null, { companyId })
      .populate({
        path: 'userId',
        select: 'firstName lastName fullName email phone isActive status roleId',
        populate: { path: 'roleId', select: 'name slug' },
      })
      .populate('departmentId', 'name code')
      .populate('designationId', 'name code')
      .populate('managerId', 'firstName lastName fullName email employeeCode')
      .populate('companyId', 'companyName companyCode');
  }

  findByUserId(userId, companyId) {
    return EmployeeProfile.findOne({ userId, companyId, isDeleted: false }, null, { companyId })
      .populate({
        path: 'userId',
        select: 'firstName lastName fullName email phone isActive status roleId',
        populate: { path: 'roleId', select: 'name slug' },
      })
      .populate('departmentId', 'name code')
      .populate('designationId', 'name code')
      .populate('managerId', 'firstName lastName fullName email');
  }

  findTeamByManager(managerId, companyId, query = {}) {
    return this.findWithUser({ companyId, managerId }, query, { companyId });
  }
}

module.exports = new EmployeeRepository();
