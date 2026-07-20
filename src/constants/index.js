const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
};

const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DUPLICATE_KEY: 'DUPLICATE_KEY',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  COMPANY_CONTEXT_REQUIRED: 'COMPANY_CONTEXT_REQUIRED',
  ACCOUNT_BLOCKED: 'ACCOUNT_BLOCKED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

const COLLECTIONS = {
  COMPANIES: 'companies',
  USERS: 'users',
  ROLES: 'roles',
  PERMISSIONS: 'permissions',
  SESSIONS: 'sessions',
  DEPARTMENTS: 'departments',
  DESIGNATIONS: 'designations',
  EMPLOYEES: 'employees',
  EMPLOYEE_PROFILES: 'employee_profiles',
  EMPLOYEE_ID_SEQUENCES: 'employee_id_sequences',
  MANAGERS: 'managers',
  ATTENDANCE: 'attendance',
  OFFICE_GEOFENCES: 'office_geofences',
  COMPANY_ATTENDANCE_POLICIES: 'company_attendance_policies',
  SHIFTS: 'shifts',
  EMPLOYEE_SHIFT_ASSIGNMENTS: 'employee_shift_assignments',
  REGULARIZATION_COUNTERS: 'regularization_counters',
  REGULARIZATION_REQUESTS: 'regularization_requests',
  WFH_REQUESTS: 'wfh_requests',
  LEAVE_REQUESTS: 'leave_requests',
  COMP_OFF_REQUESTS: 'comp_off_requests',
  HOLIDAYS: 'holidays',
  COMPANY_LEAVE_POLICIES: 'company_leave_policies',
  LEAVE_LEDGER: 'leave_ledger',
  LEAVE_BALANCES: 'leave_balances',
  SCHEDULER_JOB_LOGS: 'scheduler_job_logs',
  WORKFLOW_TEMPLATES: 'workflow_templates',
  WORKFLOW_LEVELS: 'workflow_levels',
  WORKFLOW_INSTANCES: 'workflow_instances',
  WORKFLOW_ACTIONS: 'workflow_actions',
  WORKFLOW_DELEGATIONS: 'workflow_delegations',
  WORKFLOW_ESCALATIONS: 'workflow_escalations',
  WORKFLOW_CONDITIONS: 'workflow_conditions',
  WORKFLOW_NOTIFICATIONS: 'workflow_notifications',
  POLICIES: 'policies',
  POLICY_VERSIONS: 'policy_versions',
  RULES: 'rules',
  RULE_GROUPS: 'rule_groups',
  RULE_CONDITIONS: 'rule_conditions',
  RULE_ACTIONS: 'rule_actions',
  RULE_EXECUTIONS: 'rule_executions',
  RULE_LOGS: 'rule_logs',
  PAYROLL: 'payroll',
  DOCUMENTS: 'documents',
  NOTIFICATIONS: 'notifications',
  AUDIT_LOGS: 'audit_logs',
  SETTINGS: 'settings',
};

const SYSTEM_ROLES = {
  OWNER: 'owner',
  HR: 'hr',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
};

const USER_STATUS = ['active', 'inactive', 'suspended'];
const COMPANY_STATUS = ['active', 'inactive', 'suspended'];

const AUTH = {
  MAX_FAILED_LOGIN_ATTEMPTS: 5,
  LOCK_DURATION_MINUTES: 30,
  TOKEN_TYPE_ACCESS: 'access',
  TOKEN_TYPE_REFRESH: 'refresh',
};

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'intern', 'probation'];
const EMPLOYMENT_STATUS = ['active', 'inactive', 'terminated', 'on_leave', 'resigned'];
const ATTENDANCE_STATUS = [
  'present',
  'late',
  'regularized',
  'work_from_home',
  'half_day',
  'absent',
  'holiday',
  'week_off',
  'leave',
  'missing_punch',
  'auto_punch_out',
  'on_leave',
];

const ATTENDANCE_SOURCE = ['web', 'mobile', 'manual', 'api', 'biometric', 'qr'];

const BREAK_TYPES = ['lunch', 'tea_break_1', 'tea_break_2'];
const LEAVE_STATUS = ['pending', 'approved', 'rejected', 'cancelled'];
const LEAVE_TYPES = {
  EL: 'earned_leave',
  ML: 'medical_leave',
  CL: 'casual_leave',
  SL: 'short_leave',
  LOP: 'loss_of_pay',
  COMP_OFF: 'comp_off',
  MATERNITY: 'maternity',
  PATERNITY: 'paternity',
  MARRIAGE: 'marriage',
  BEREAVEMENT: 'bereavement',
  OPTIONAL_HOLIDAY: 'optional_holiday',
};
const LEAVE_TYPE_CODES = Object.keys(LEAVE_TYPES);
const CREDIT_CYCLES = ['monthly', 'quarterly', 'half_yearly', 'yearly'];
const LEDGER_TRANSACTION_TYPES = ['opening_balance', 'credit', 'debit', 'adjustment'];
const APPROVAL_STAGES = ['manager', 'hr'];
const HALF_DAY_SESSIONS = ['morning', 'afternoon'];
const SCHEDULER_JOB_STATUS = ['running', 'completed', 'failed', 'retrying'];
const SCHEDULER_FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly'];
const WORKFLOW_TYPES = [
  'leave',
  'comp_off',
  'attendance_regularization',
  'expense',
  'document',
  'asset',
  'travel',
  'loan',
  'salary_revision',
  'promotion',
  'transfer',
  'resignation',
];
const WORKFLOW_STATUS = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'sent_back',
  'escalated',
  'delegated',
  'completed',
];
const WORKFLOW_ACTION_TYPES = [
  'approve',
  'reject',
  'send_back',
  'cancel',
  'escalate',
  'forward',
  'skip',
  'delegate',
];
const APPROVER_TYPES = [
  'reporting_manager',
  'department_manager',
  'hr',
  'owner',
  'leave_approver',
  'specific_user',
  'specific_role',
];
const APPROVAL_MODES = ['sequential', 'parallel'];
const CONDITION_OPERATORS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'between', 'contains', 'starts_with', 'ends_with'];
const LOGICAL_OPERATORS = ['and', 'or', 'not'];
const POLICY_TYPES = [
  'attendance',
  'leave',
  'payroll',
  'shift',
  'holiday',
  'expense',
  'probation',
  'promotion',
  'resignation',
  'document',
  'asset',
  'notification',
  'workflow',
  'performance',
  'recruitment',
];
const POLICY_STATUS = ['draft', 'published', 'archived'];
const RULE_TYPES = [
  'attendance',
  'leave',
  'payroll',
  'shift',
  'holiday',
  'approval',
  'document',
  'expense',
  'notification',
  'performance',
  'workflow',
];
const RULE_STATUS = ['draft', 'published', 'archived', 'disabled'];
const RULE_PRIORITIES = ['high', 'medium', 'low'];
const RULE_PRIORITY_ORDER = { high: 1, medium: 2, low: 3 };
const RULE_ACTION_TYPES = [
  'approve',
  'reject',
  'allow',
  'block',
  'auto_approve',
  'auto_reject',
  'generate_warning',
  'generate_notification',
  'trigger_workflow',
  'trigger_payroll_update',
  'trigger_attendance_update',
  'create_audit_log',
  'set_status',
  'convert_to_lop',
  'credit_leave',
];
const RULE_EXECUTION_MODES = ['sequential', 'parallel'];
const RULE_EXECUTION_STATUS = ['success', 'failed', 'skipped', 'partial'];
const PAYROLL_STATUS = ['draft', 'processed', 'paid', 'cancelled'];
const NOTIFICATION_TYPES = ['info', 'warning', 'success', 'error', 'action_required'];

const AUDIT_ACTIONS = [
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'failed_login',
  'password_change',
  'company_switch',
  'block',
  'unblock',
  'activate',
  'export',
  'import',
  'approve',
  'reject',
  'punch_in',
  'punch_out',
  'break_start',
  'break_end',
  'attendance_correct',
  'auto_punch_out',
  'leave_apply',
  'leave_approve',
  'leave_reject',
  'leave_cancel',
  'leave_credit',
  'leave_debit',
  'leave_manual_add',
  'comp_off_raise',
  'comp_off_cancel',
  'comp_off_approve',
  'comp_off_reject',
  'regularization_apply',
  'regularization_raise_auto_approve',
  'regularization_cancel',
  'regularization_approve',
  'regularization_reject',
  'scheduler_run',
  'workflow_start',
  'workflow_approve',
  'workflow_reject',
  'workflow_escalate',
  'workflow_delegate',
  'rule_evaluate',
  'rule_publish',
];

const DOCUMENT_CATEGORIES = ['identity', 'education', 'employment', 'tax', 'other'];
const SETTING_CATEGORIES = ['general', 'attendance', 'leave', 'payroll', 'notification', 'security'];

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

module.exports = {
  HTTP_STATUS,
  ERROR_CODES,
  PAGINATION,
  COLLECTIONS,
  SYSTEM_ROLES,
  USER_STATUS,
  COMPANY_STATUS,
  AUTH,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_STATUS,
  ATTENDANCE_STATUS,
  ATTENDANCE_SOURCE,
  BREAK_TYPES,
  LEAVE_STATUS,
  LEAVE_TYPES,
  LEAVE_TYPE_CODES,
  CREDIT_CYCLES,
  LEDGER_TRANSACTION_TYPES,
  APPROVAL_STAGES,
  HALF_DAY_SESSIONS,
  SCHEDULER_JOB_STATUS,
  SCHEDULER_FREQUENCIES,
  WORKFLOW_TYPES,
  WORKFLOW_STATUS,
  WORKFLOW_ACTION_TYPES,
  APPROVER_TYPES,
  APPROVAL_MODES,
  CONDITION_OPERATORS,
  LOGICAL_OPERATORS,
  POLICY_TYPES,
  POLICY_STATUS,
  RULE_TYPES,
  RULE_STATUS,
  RULE_PRIORITIES,
  RULE_PRIORITY_ORDER,
  RULE_ACTION_TYPES,
  RULE_EXECUTION_MODES,
  RULE_EXECUTION_STATUS,
  PAYROLL_STATUS,
  NOTIFICATION_TYPES,
  AUDIT_ACTIONS,
  DOCUMENT_CATEGORIES,
  SETTING_CATEGORIES,
  PASSWORD_REGEX,
};
