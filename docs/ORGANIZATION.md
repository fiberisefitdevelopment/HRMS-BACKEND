# Organization Management — Phase 3

## Collection Relationships

```
Company (1) ──→ (N) Department
Company (1) ──→ (N) Designation
Company (1) ──→ (N) User
User (1) ──→ (1) EmployeeProfile  [via userId]
EmployeeProfile (N) ──→ (1) Department
EmployeeProfile (N) ──→ (1) Designation
EmployeeProfile (N) ──→ (1) User [managerId, optional]
EmployeeIdSequence (1) ──→ (1) Company  [auto ID counter]
```

- **Users** hold authentication identity (email, password, roleId, companyId)
- **EmployeeProfile** holds all workforce-specific data linked by `userId`
- **Managers** are Users with `manager` role — no separate managers collection for assignments
- **companyId** on every profile enforces tenant isolation

## Employee Lifecycle

```
Create → User + EmployeeProfile + auto employeeId
Active → status: active, user.isActive: true
Deactivate → status: inactive, user.isActive: false
Soft Delete → isDeleted: true, status: terminated
```

## Employee ID Generation

```
Prefix = companyCode.substring(0, EMPLOYEE_ID_PREFIX_LENGTH)  // default 3 → VYT, FIB
Sequence = atomic increment per company in employee_id_sequences
Format = PREFIX + zeroPadded(sequence)  // VYT0001, FIB0003
```

Configurable via `.env`:
```
EMPLOYEE_ID_PREFIX_LENGTH=3
EMPLOYEE_ID_PADDING=4
```

## Excel Import Flow

```
Upload xlsx/csv
  → Validate template columns
  → Parse rows
  → Per row: validate fields, check duplicate emails
  → Preview / Dry Run (no writes)
  → Execute: create departments/designations if missing
  → Create User + EmployeeProfile per valid row
  → Return report: rowNumber, status, reason, imported
```

**Required columns:** firstName, lastName, officialEmail, joiningDate, department, designation

## Export Flow

```
GET /employees/export/:type?format=xlsx|csv
Types: employees, departments, designations, managers
  → Query company-scoped data
  → Generate file in uploads/exports/
  → Download response + audit log
```

## Folder Structure

```
src/modules/
  companies/       company CRUD (Owner only)
  departments/     department CRUD
  designations/    designation CRUD
  employees/
    employeeProfile.model.js
    employeeIdSequence.model.js
    employeeId.generator.js
    employee.service.js
    import.service.js
    export.service.js
    employee.routes.js
  managers/        assign/change/remove manager, view team
```

## API Endpoints

| Module | Endpoints |
|--------|-----------|
| Companies | `GET/POST /companies`, `GET/PUT/DELETE /companies/:id`, `POST .../activate`, `.../deactivate` |
| Departments | `GET/POST /departments`, `GET/PUT/DELETE /departments/:id` |
| Designations | `GET/POST /designations`, `GET/PUT/DELETE /designations/:id` |
| Employees | `GET/POST /employees`, `GET/PUT/DELETE /employees/:id`, `GET /employees/me` |
| Employees | `POST /employees/:id/activate`, `.../deactivate`, `.../photo` |
| Import | `POST /employees/import/preview`, `POST /employees/import?dryRun=true` |
| Export | `GET /employees/export/:type?format=xlsx` |
| Bulk | `POST /employees/bulk/activate`, `.../deactivate`, `.../delete`, `.../department`, `.../designation`, `.../manager` |
| Managers | `POST /managers/assign`, `.../change`, `.../remove`, `GET /managers/team` |

## Role Access

| Action | Owner | HR | Manager | Employee |
|--------|-------|-----|---------|----------|
| Company CRUD | Yes | No | No | No |
| Dept/Designation CRUD | Yes | Yes | No | No |
| Employee CRUD | Yes | Yes | Team update | Own profile |
| Import/Export | Yes | Yes | No | No |
| Manager assign | Yes | Yes | No | No |
| View team | Yes | Yes | Own team | No |
