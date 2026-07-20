# Leave Management — Phase 5

## Scheduler Engine

Centralized job runner at `src/modules/scheduler/scheduler.service.js` using **node-cron**.

```
registerJob(name, cronExpression, handler, options)
  → executeWithRetry (max 3 attempts)
  → JobExecutionLog (status, attempts, errors, result)
  → Audit log (scheduler_run)
```

Supported frequencies: daily, weekly, monthly, quarterly, half_yearly, yearly.

| Job | Schedule | Action |
|-----|----------|--------|
| `monthly-leave-processing` | 1st @ 00:30 | SL reset, regularization reset, summaries |
| `quarterly-leave-processing` | Jan/Apr/Jul/Oct @ 01:00 | Credit EL, CL, ML (per policy) |
| `half-yearly-leave-processing` | Jan/Jul @ 01:30 | Credit ML (Vytalix) |

## Monthly Processing Engine

At month end:
1. Reset Short Leave balance to policy allowance
2. Reset Regularization counters for current month
3. Generate Monthly Leave Summary
4. Prepare Payroll Summary (flagged)
5. Generate monthly reports (logged)

## Quarterly Processing

Credits leave per `company_leave_policies.leaveTypes` where `creditCycle = quarterly`:
- **Vytalix:** EL (4), CL (2)
- **Fiberise:** EL (4), CL (2), ML (2)

## Half-Yearly Processing

Credits leave where `creditCycle = half_yearly`:
- **Vytalix:** ML (6)

## Leave Ledger

Never derive balance from leave history. Every transaction writes to `leave_ledger`:

```
openingBalance + credit - debit + adjustment = closingBalance
```

Transaction types: `opening_balance`, `credit`, `debit`, `adjustment`

Current balance stored in `leave_balances` (updated atomically with ledger).

## Leave Policy Engine

Each company has `company_leave_policies` with configurable:
- Leave types (credit amount, cycle, max balance, carry forward)
- Short leave rules (monthly allowance, auto-deduct)
- Approval workflow stages
- Holidays and working day rules

**No hardcoded rules** — all engines read from policy document.

## Approval Flow

Leave approval is **native** (no workflow instance):

```
Employee applies → Manager / HR / Owner approves via PUT /leave/:id/approve
                  ↘ reject via PUT /leave/:id/reject
```

GET `/leave` and `/leave/:id` return:
- `approvals[]` with `approver` (name/email) and `actedAt`
- `approvedBy` / `approvedAt` when approved
- `rejectedBy` / `rejectedReason` when rejected

No `workflowInstanceId` is created on apply.

Configurable via `approvalWorkflow.stages` (single manager stage).

## Attendance Integration

On final approval, `attendanceIntegration.engine` updates/creates attendance records:
- Full day → `attendanceStatus: leave`
- Half day → `attendanceStatus: half_day`

On cancellation of approved leave, attendance is reverted.

## Database Design

```
Company → CompanyLeavePolicy (1 default)
Company → LeaveRequest (many)
EmployeeProfile → LeaveBalance (per leave type)
EmployeeProfile → LeaveLedger (transactions)
EmployeeProfile → LeaveRequest
LeaveRequest → AttendanceRecord (on approval)
Scheduler → JobExecutionLog
```

## Seeded Policies

| Company | EL | ML | CL | SL |
|---------|----|----|----|-----|
| Vytalix | 4/quarter | 6/half-year | 2/quarter | 1/month |
| Fiberise | 4/quarter | 2/quarter | 2/quarter | 1/month |

## API Endpoints

```
POST   /leave                    Apply leave (no workflow instance)
GET    /leave                    List leaves (includes approvedBy / approvals)
GET    /leave/:id                Get leave (includes who approved/rejected)
PUT    /leave/:id/approve        Approve (manager / HR / owner)
PUT    /leave/:id/reject         Reject
PUT    /leave/:id/cancel         Cancel
GET    /leave/balances           My balances
GET    /leave/ledger             My ledger
GET    /leave/calendar           Calendar view
GET    /leave/monthly-summary    Monthly summary
GET    /leave/reports/:type      Reports
GET    /leave/export/:type       Excel/CSV export
GET/PUT /leave-policies          Company policy
```

Report types: `balance`, `summary`, `company`, `department`, `monthly`, `quarterly`, `short_leave`

## Compensatory Off

Raise overtime-based credit via `/comp-off`, then apply leave with `COMP_OFF`. See [COMP_OFF.md](./COMP_OFF.md).

## PDF Export

Architecture prepared in `export.service.js` — extend with pdfkit/puppeteer without changing service contracts.
