const BaseRepository = require('../../shared/base/base.repository');
const AttendanceRecord = require('./attendanceRecord.model');
const { parsePagination, parseSort, buildPaginationMeta } = require('../../utils/pagination');
const { getDateOnly, addDays } = require('../../utils/time');

class AttendanceRepository extends BaseRepository {
  constructor() {
    super(AttendanceRecord);
  }

  /** Match IST calendar day whether date was stored as IST midnight or UTC midnight. */
  istDayFilter(date = new Date()) {
    const dayStart = getDateOnly(date);
    const dayEnd = addDays(dayStart, 1);
    return { $gte: dayStart, $lt: dayEnd };
  }

  findTodayRecord(employeeProfileId, companyId, date = new Date()) {
    return AttendanceRecord.findOne(
      { employeeProfileId, companyId, date: this.istDayFilter(date) },
      null,
      { companyId }
    )
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
    // Open session clears punchOut (or leaves it unset). Match legacy + multi-session records.
    return AttendanceRecord.find(
      {
        companyId,
        date: this.istDayFilter(date),
        'punchIn.timestamp': { $exists: true },
        $or: [{ punchOut: null }, { 'punchOut.timestamp': { $exists: false } }],
      },
      null,
      { companyId }
    ).populate('userId', 'firstName lastName email');
  }

  /** All attendance up to `upToDate` (inclusive) that may still have an open punch session. */
  findOpenPunchRecords(companyId, upToDate = new Date()) {
    const dayEndExclusive = addDays(getDateOnly(upToDate), 1);
    return AttendanceRecord.find(
      {
        companyId,
        date: { $lt: dayEndExclusive },
        'punchIn.timestamp': { $exists: true },
      },
      null,
      { companyId }
    ).populate('userId', 'firstName lastName email');
  }
}

module.exports = new AttendanceRepository();
