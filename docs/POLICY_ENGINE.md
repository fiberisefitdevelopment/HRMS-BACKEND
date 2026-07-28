# Phase 5.6 — Policy Engine & Rule Engine

Centralized, configurable policy and rule evaluation for all HRMS modules. Business rules live in the database — not in module code.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Layer                                 │
│  /policy-engine/policies  /rules  /test  /evaluate  /reports    │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                     Service Layer                                │
│  policy.service  rule.service  evaluator.service                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                   policyEngine.facade                            │
│  evaluate()  test()  getPolicy()                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐  ┌─────────────────┐  ┌──────────────────┐
│ ruleEvaluator │  │ conditionEval   │  │ actionExecutor   │
│   .engine     │  │   .engine       │  │   .engine        │
└───────────────┘  └─────────────────┘  └──────────────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             ▼
                    MongoDB Collections
```

## Policy Engine

Each company maintains independent policies. A **policy** is a container for rules of a given type.

| Policy Type | Examples |
|-------------|----------|
| `attendance` | Working hours, late thresholds, punch rules |
| `leave` | Balance conversion, approval triggers |
| `payroll` | Salary approval thresholds |
| `shift` | Shift assignment rules |
| `holiday` | Holiday calendar rules |
| `expense` | Expense limits |
| `workflow` | Approval routing |
| `document` | Document retention |
| `notification` | Alert triggers |

### Policy Lifecycle

```
draft → published → archived
         ↓
    policy_versions (snapshot on publish)
         ↓
    rollback (restore prior version)
```

### Policy Assignment

Policies can be assigned by:

- **Default** (`isDefault: true`) — company-wide fallback
- **Department** (`assignedDepartmentIds`)
- **Employee** (`assignedEmployeeProfileIds`)

Resolution order: employee assignment → department → default.

## Rule Engine

Generic evaluator. Input:

| Input | Description |
|-------|-------------|
| `Employee` | `userId`, `employeeProfileId` |
| `Company` | `companyId` |
| `Request` | `context` object (module-specific facts) |
| `Policy` | Optional `policyId` filter |
| `Context` | Execution metadata (`triggeredBy`, `dryRun`, `module`) |

Output: matched rules, actions executed, merged outputs, warnings, audit records.

### Rule Types

`attendance`, `leave`, `payroll`, `shift`, `holiday`, `approval`, `document`, `expense`, `notification`, `performance`, `future`

### Condition Operators

| Operator | Description |
|----------|-------------|
| `eq`, `ne` | Equal / Not equal |
| `gt`, `gte`, `lt`, `lte` | Numeric comparison |
| `between` | Range `[min, max]` |
| `in` | Value in array |
| `contains`, `starts_with`, `ends_with` | String matching |

### Logical Groups

Conditions are grouped with `AND`, `OR`, `NOT`. Groups support nesting via `rule_groups` with `parentGroupId`.

### Action Types

| Action | Effect |
|--------|--------|
| `allow` / `block` | Permit or deny request |
| `approve` / `reject` | Approval decision |
| `auto_approve` / `auto_reject` | Automatic decision |
| `set_status` | Set field value (e.g. `attendanceStatus`) |
| `convert_to_lop` | Convert leave to loss-of-pay |
| `credit_leave` | Credit leave balance |
| `generate_warning` | Return warning message |
| `generate_notification` | Create in-app notification |
| `trigger_workflow` | Signal workflow engine |
| `trigger_attendance_update` | Attendance status override |
| `trigger_payroll_update` | Payroll side-effect |
| `create_audit_log` | Audit trail entry |

Custom handlers can be registered via `registerActionHandler()`.

## Evaluation Flow

```
1. Load published + enabled rules for (companyId, ruleType)
2. Filter by schedule (effectiveFrom / effectiveTo)
3. Sort by priority (high → medium → low)
4. For each rule (sequential or parallel):
   a. Load rule_groups, rule_conditions, rule_actions
   b. Evaluate condition tree against context
   c. If matched → execute actions
   d. Merge outputs; respect stopOnFailure / continueOnFailure
5. Persist rule_executions + rule_logs (unless dryRun)
6. Return aggregated result
```

## Rule Priority & Execution

| Priority | Order |
|----------|-------|
| `high` | 1 |
| `medium` | 2 |
| `low` | 3 |

`executionMode`: `sequential` (default) or `parallel`.

## Versioning

| Entity | Versioning |
|--------|------------|
| Policy | `version` field + `policy_versions` snapshots on publish |
| Rule | `status`: draft → published → archived; clone creates new draft |

## Rule Tester (Dry Run)

`POST /policy-engine/test` evaluates rules with `dryRun: true`. No executions or logs are persisted.

```json
{
  "ruleType": "attendance",
  "context": { "netWorkingMinutes": 520, "lateCount": 0 },
  "ruleId": "optional-specific-rule-id"
}
```

## Performance Optimization

- Compound indexes on `(companyId, ruleType, status, isEnabled)`
- Rules pre-filtered by schedule before evaluation
- Condition groups indexed by `ruleId` + `order`
- Execution logs paginated for reports
- Priority sort at query time (not in-memory)

## Module Integration

### Attendance (`punchOut`)

After working-hours calculation, `applyAttendanceRules()` overlays rule-driven status:

```javascript
const ruleResult = await applyAttendanceRules({
  companyId, userId, employeeProfileId,
  context: { netWorkingMinutes, lateCount, hasPunchOut, attendanceStatus },
  triggeredBy: userId,
});
if (ruleResult.attendanceStatus) attendanceStatus = ruleResult.attendanceStatus;
```

### Leave (`applyLeave`)

Before balance validation, `applyLeaveRules()` can block or convert to LOP:

```javascript
const ruleResult = await applyLeaveRules({
  companyId, userId, employeeProfileId,
  context: { totalDays, leaveTypeCode, mlBalance, probationCompleted },
  triggeredBy: userId,
});
```

### Workflow

`workflow/engines/condition.engine.js` delegates single-condition evaluation to the shared `conditionEvaluator.engine.js`.

### Payroll / Notifications (future)

Use `policyEngineFacade.evaluate({ ruleType: 'payroll', ... })` or register custom action handlers.

## Database Relationships

```
policies (1) ──→ (N) rules
rules (1) ──→ (N) rule_groups
rule_groups (1) ──→ (N) rule_conditions
rules (1) ──→ (N) rule_actions
rules (1) ──→ (N) rule_executions
rule_executions (1) ──→ (1) rule_logs
policies (1) ──→ (N) policy_versions
```

## API Endpoints

| Method | Path | Permission |
|--------|------|------------|
| GET | `/policy-engine/policies` | `policy.read` |
| POST | `/policy-engine/policies` | `policy.manage` |
| PUT | `/policy-engine/policies/:id/publish` | `policy.manage` |
| PUT | `/policy-engine/policies/:id/archive` | `policy.manage` |
| POST | `/policy-engine/policies/:id/clone` | `policy.manage` |
| PUT | `/policy-engine/policies/:id/rollback` | `policy.manage` |
| GET | `/policy-engine/rules` | `policy.rule.read` |
| POST | `/policy-engine/rules` | `policy.rule.manage` |
| PUT | `/policy-engine/rules/:id/publish` | `policy.rule.manage` |
| POST | `/policy-engine/test` | `policy.rule.test` |
| POST | `/policy-engine/evaluate` | `policy.rule.evaluate` |
| GET | `/policy-engine/executions` | `policy.report` |
| GET | `/policy-engine/reports/:type` | `policy.report` |

Report types: `statistics`, `usage`, `failed`, `execution-time`.

## Role Access

| Role | Access |
|------|--------|
| Owner | Full access (all permissions) |
| HR | Policy + rule management, test, evaluate, reports |
| Manager | View policies and rules |
| Employee | No access |

## Seeded Rules (VYTALIX & FIBERISE)

**Attendance:** Present (≥510 min), Half Day (270–509 min), Late Count ≥3 → Half Day, Missing Punch Out.

**Leave:** >5 days → Owner approval workflow, ML balance 0 → Convert to LOP, Probation complete → Credit EL.

## Example Rules

| Condition | Action |
|-----------|--------|
| `lateCount >= 3` | Half Day |
| `totalDays > 5` | Owner Approval |
| `netWorkingMinutes >= 510` | Present |
| `netWorkingMinutes between [270,509]` | Half Day |
| `leaveTypeCode = ML AND mlBalance = 0` | Convert to LOP |
| `probationCompleted = true` | Credit EL |
| `hasPunchOut = false` | Missing Punch |
| `salary > 100000` | Additional Approval |
