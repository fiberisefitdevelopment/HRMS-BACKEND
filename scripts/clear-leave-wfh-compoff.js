require('dotenv').config();
const { connectDatabase, disconnectDatabase } = require('../src/database/connection');
const LeaveBalance = require('../src/modules/leave/leaveBalance.model');
const LeaveLedger = require('../src/modules/leave/leaveLedger.model');
const LeaveRequest = require('../src/modules/leave/leaveRequest.model');
const WfhRequest = require('../src/modules/wfh/wfhRequest.model');
const CompOffRequest = require('../src/modules/comp-off/compOffRequest.model');
const AttendanceRecord = require('../src/modules/attendance/attendanceRecord.model');
const RegularizationRequest = require('../src/modules/regularization/regularizationRequest.model');
const RegularizationCounter = require('../src/modules/attendance/regularizationCounter.model');
const WorkflowInstance = require('../src/modules/workflow/workflowInstance.model');
const Notification = require('../src/modules/notifications/notification.model');
const MODULE_TYPES = ['leave','wfh','comp_off','comp-off','attendance','regularization','attendance_regularization'];
(async () => {
  await connectDatabase();
  const deleted = {
    leaveBalances: (await LeaveBalance.deleteMany({})).deletedCount,
    leaveLedger: (await LeaveLedger.deleteMany({})).deletedCount,
    leaveRequests: (await LeaveRequest.deleteMany({})).deletedCount,
    wfhRequests: (await WfhRequest.deleteMany({})).deletedCount,
    compOffRequests: (await CompOffRequest.deleteMany({})).deletedCount,
    attendance: (await AttendanceRecord.deleteMany({})).deletedCount,
    regularizationRequests: (await RegularizationRequest.deleteMany({})).deletedCount,
    regularizationCounters: (await RegularizationCounter.deleteMany({})).deletedCount,
    relatedWorkflows: (await WorkflowInstance.deleteMany({ moduleType: { $in: MODULE_TYPES } })).deletedCount,
    relatedNotifications: (await Notification.deleteMany({
      $or: [
        { type: /leave|wfh|comp.?off|attendance|regularization|punch/i },
        { entityType: { $in: ['leave','leave_request','wfh','wfh_request','comp_off','comp_off_request','attendance','regularization','regularization_request'] } },
        { category: /leave|wfh|comp.?off|attendance|regularization/i },
      ],
    })).deletedCount,
  };
  console.log('DELETED', deleted);
  await disconnectDatabase();
})().catch((e) => { console.error(e); process.exit(1); });
