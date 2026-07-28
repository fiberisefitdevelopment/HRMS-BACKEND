const Company = require('../modules/companies/company.model');
const User = require('../modules/users/user.model');
const Role = require('../modules/roles/role.model');
const Permission = require('../modules/permissions/permission.model');
const Session = require('../modules/auth/session.model');
const Department = require('../modules/departments/department.model');
const Designation = require('../modules/designations/designation.model');
const EmployeeProfile = require('../modules/employees/employeeProfile.model');
const EmployeeIdSequence = require('../modules/employees/employeeIdSequence.model');
const CompanyAttendancePolicy = require('../modules/attendance-policies/companyAttendancePolicy.model');
const Shift = require('../modules/shifts/shift.model');
const EmployeeShiftAssignment = require('../modules/shifts/employeeShiftAssignment.model');
const AttendanceRecord = require('../modules/attendance/attendanceRecord.model');
const OfficeGeofence = require('../modules/geofences/officeGeofence.model');
const RegularizationCounter = require('../modules/attendance/regularizationCounter.model');
const RegularizationRequest = require('../modules/regularization/regularizationRequest.model');
const WfhRequest = require('../modules/wfh/wfhRequest.model');
const LeaveRequest = require('../modules/leave/leaveRequest.model');
const CompOffRequest = require('../modules/comp-off/compOffRequest.model');
const Holiday = require('../modules/holidays/holiday.model');
const LeaveLedger = require('../modules/leave/leaveLedger.model');
const LeaveBalance = require('../modules/leave/leaveBalance.model');
const CompanyLeavePolicy = require('../modules/leave-policies/companyLeavePolicy.model');
const JobExecutionLog = require('../modules/scheduler/jobExecutionLog.model');
const WorkflowTemplate = require('../modules/workflow/workflowTemplate.model');
const WorkflowLevel = require('../modules/workflow/workflowLevel.model');
const WorkflowInstance = require('../modules/workflow/workflowInstance.model');
const WorkflowAction = require('../modules/workflow/workflowAction.model');
const WorkflowDelegation = require('../modules/workflow/workflowDelegation.model');
const WorkflowEscalation = require('../modules/workflow/workflowEscalation.model');
const WorkflowCondition = require('../modules/workflow/workflowCondition.model');
const WorkflowNotification = require('../modules/workflow/workflowNotification.model');
const Policy = require('../modules/policy-engine/policy.model');
const PolicyVersion = require('../modules/policy-engine/policyVersion.model');
const Rule = require('../modules/policy-engine/rule.model');
const RuleGroup = require('../modules/policy-engine/ruleGroup.model');
const RuleCondition = require('../modules/policy-engine/ruleCondition.model');
const RuleAction = require('../modules/policy-engine/ruleAction.model');
const RuleExecution = require('../modules/policy-engine/ruleExecution.model');
const RuleLog = require('../modules/policy-engine/ruleLog.model');
const Payroll = require('../modules/payroll/payroll.model');
const Document = require('../modules/documents/document.model');
const Notification = require('../modules/notifications/notification.model');
const AuditLog = require('../modules/audit/auditLog.model');
const Setting = require('../modules/settings/setting.model');

module.exports = {
  Company,
  User,
  Role,
  Permission,
  Session,
  Department,
  Designation,
  EmployeeProfile,
  EmployeeIdSequence,
  CompanyAttendancePolicy,
  Shift,
  EmployeeShiftAssignment,
  AttendanceRecord,
  OfficeGeofence,
  RegularizationCounter,
  RegularizationRequest,
  WfhRequest,
  LeaveRequest,
  CompOffRequest,
  Holiday,
  LeaveLedger,
  LeaveBalance,
  CompanyLeavePolicy,
  JobExecutionLog,
  WorkflowTemplate,
  WorkflowLevel,
  WorkflowInstance,
  WorkflowAction,
  WorkflowDelegation,
  WorkflowEscalation,
  WorkflowCondition,
  WorkflowNotification,
  Policy,
  PolicyVersion,
  Rule,
  RuleGroup,
  RuleCondition,
  RuleAction,
  RuleExecution,
  RuleLog,
  Payroll,
  Document,
  Notification,
  AuditLog,
  Setting,
};
