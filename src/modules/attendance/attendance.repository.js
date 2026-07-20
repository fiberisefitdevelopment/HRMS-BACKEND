const BaseRepository = require('../../shared/base/base.repository');
const AttendanceRecord = require('./attendanceRecord.model');
const { parsePagination, parseSort, buildPaginationMeta } = require('../../utils/pagination');
const { getDateOnly } = require('../../utils/time');

class AttendanceRepository extends BaseRepository {
  constructor() {
    super(AttendanceRecord);
  }

  findTodayRecord(employeeProfileId, companyId, date = new Date()) {
    const day = getDateOnly(date);
    return AttendanceRecord.findOne({ employeeProfileId, companyId, date: day }, null, { companyId })
      .populate('shiftId', 'name code startTime endTime')
      .populate('employeeProfileId', 'employeeId userId departmentId');
  }

  findByDateRange(filter, query, options = {}) {
    const { page, limit, skip } = parsePagination(query);
    const sort = parseSort(query.sort, { date: -1 });

    return Promise.all([
      AttendanceRecord.find(filter, null, options)
        .populate('employeeProfileId', 'employeeId userId departmentId')
        .populate('userId', 'firstName lastName fullName email')
        .populate('shiftId', 'name code startTime endTime')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      AttendanceRecord.countDocuments(filter, options),
    ]).then(([data, total]) => ({ data, meta: buildPaginationMeta(total, page, limit) }));
  }

  findPendingPunchOut(companyId, date) {
    const day = getDateOnly(date);
    // Open session clears punchOut (or leaves it unset). Match legacy + multi-session records.
    return AttendanceRecord.find(
      {
        companyId,
        date: day,
        'punchIn.timestamp': { $exists: true },
        $or: [{ punchOut: null }, { 'punchOut.timestamp': { $exists: false } }],
      },
      null,
      { companyId }
    ).populate('userId', 'firstName lastName email');
  }
}

module.exports = new AttendanceRepository();
