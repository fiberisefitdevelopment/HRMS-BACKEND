# HRMS Backend — Architecture Documentation

## 1. Overall Architecture

This HRMS is built as a **Modular Monolith** — a single deployable Node.js application with strict internal module boundaries. Each feature (auth, employees, payroll, etc.) is self-contained but shares common infrastructure (config, logging, error handling, database plugins).

### Why Modular Monolith?

| Decision | Rationale |
|----------|-----------|
| Single VPS deployment | Hostinger VPS runs one PM2 cluster — no orchestration overhead |
| No Redis/RabbitMQ | Reduces infrastructure cost and operational complexity |
| Module boundaries | Teams can work on features independently; future extraction to services is possible |
| Shared MongoDB | Single database with `companyId` isolation is simpler than distributed transactions |

### Multi-Company Model

```
Owner (User)
  ├── Vytalix Medical Pvt Ltd (Company)
  │     ├── HR users (multi-company access)
  │     ├── Managers (single company)
  │     └── Employees (single company)
  └── Fiberise Fit Pvt Ltd (Company)
        ├── HR users
        ├── Managers
        └── Employees
```

**Company isolation** is enforced at three layers:
1. **Auth layer** — JWT payload + `activeCompanyId` on user session
2. **Middleware** — `requireCompanyContext` rejects requests without company scope
3. **Database plugin** — `companyIsolation.plugin` auto-filters queries when `companyId` is passed in query options

Never trust `companyId` from request body or query params.

---

## 2. Folder Structure

```
src/
├── config/
│   ├── index.js          # Central env-based configuration
│   ├── logger.js         # Winston daily-rotate setup
│   ├── jwt.js            # Token sign/verify utilities (auth phase)
│   └── upload.js         # Multer configuration
│
├── database/
│   ├── connection.js     # Mongoose connect/disconnect
│   ├── models.js         # Model registry (single import point)
│   └── plugins/
│       ├── companyIsolation.plugin.js
│       └── timestamps.plugin.js
│
├── middlewares/
│   ├── requestId.middleware.js
│   ├── validate.middleware.js      # Zod validation wrapper
│   ├── companyContext.middleware.js
│   ├── notFound.middleware.js
│   └── errorHandler.middleware.js
│
├── constants/
│   └── index.js          # HTTP status, error codes, enums
│
├── helpers/
│   ├── response.js       # sendSuccess, sendFailure, sendCreated
│   └── password.js       # bcrypt hash/compare
│
├── utils/
│   ├── ApiError.js
│   ├── catchAsync.js
│   ├── pick.js
│   └── pagination.js
│
├── shared/
│   ├── base/
│   │   ├── base.repository.js
│   │   └── base.service.js
│   └── module.registry.js
│
├── modules/
│   ├── auth/
│   ├── companies/
│   ├── users/
│   ├── roles/
│   ├── permissions/
│   ├── employees/
│   ├── managers/
│   ├── attendance/
│   ├── leave/
│   ├── payroll/
│   ├── departments/
│   ├── designations/
│   ├── documents/
│   ├── notifications/
│   ├── audit/
│   ├── settings/
│   └── dashboard/
│
├── routes/
│   └── index.js          # Mounts all module routes
│
├── app.js                # Express middleware stack
└── server.js             # Bootstrap + graceful shutdown
```

### Why Each Folder Exists

| Folder | Purpose |
|--------|---------|
| `config/` | Single source of truth for environment variables — no `process.env` scattered in code |
| `database/` | Connection lifecycle and reusable Mongoose plugins |
| `middlewares/` | Cross-cutting HTTP concerns applied before controllers |
| `constants/` | Prevents magic strings; shared enums across modules |
| `helpers/` | Stateless utilities used by multiple modules |
| `utils/` | Low-level primitives (errors, async wrapper, pagination math) |
| `shared/` | Base classes and patterns inherited by feature modules |
| `modules/` | Feature boundaries — each owns its full vertical slice |
| `routes/` | Central route registration — one place to see all API surface |

---

## 3. Database Design

### 3.1 Companies

**Purpose:** Tenant entity. Each company is an isolated organizational unit.

| Field | Type | Notes |
|-------|------|-------|
| name | String | Display name |
| code | String | Unique identifier (e.g. `VYTALIX`, `FIBERISE`) |
| legalName | String | Registered legal name |
| gstNumber, panNumber | String | Tax identifiers |
| address | Object | Structured address |
| isActive | Boolean | Soft deactivation |

**Indexes:** `code` (unique), `isActive`, text on `name`

**Relationships:** Parent to all company-scoped collections via `companyId`

**Scalability:** Company metadata is small; shard key candidate if multi-region needed

---

### 3.2 Users

**Purpose:** Authentication identity. A user can belong to multiple companies (Owner, HR) or one (Manager, Employee).

| Field | Type | Notes |
|-------|------|-------|
| email | String | Unique login identifier |
| password | String | bcrypt hashed, `select: false` |
| companies[] | Array | `{ companyId, roleId, isDefault }` |
| activeCompanyId | ObjectId | Currently selected company context |
| twoFactorEnabled | Boolean | Future 2FA support |
| isEmailVerified | Boolean | Future email verification |

**Indexes:** `email` (unique), `companies.companyId`, `activeCompanyId`

**Validation:** Min 1 company; password min 8 chars

---

### 3.3 Roles

**Purpose:** RBAC role definitions per company (or system-wide for Owner).

| Field | Type | Notes |
|-------|------|-------|
| slug | String | e.g. `owner`, `hr`, `manager`, `employee` |
| companyId | ObjectId | `null` for system roles |
| permissions[] | ObjectId[] | References Permission collection |
| hierarchy | Number | For permission inheritance ordering |

**Indexes:** `{ slug, companyId }` unique compound

---

### 3.4 Permissions

**Purpose:** Granular action-level access control.

| Field | Type | Notes |
|-------|------|-------|
| slug | String | e.g. `employees:read` |
| module | String | Feature module name |
| action | Enum | create, read, update, delete, manage, approve, export |

**Indexes:** `slug` unique, `{ module, action }`

---

### 3.5 Sessions

**Purpose:** Refresh token storage for secure session management.

| Field | Type | Notes |
|-------|------|-------|
| userId | ObjectId | Session owner |
| refreshTokenHash | String | Hashed token, never store plain |
| companyId | ObjectId | Active company at login |
| expiresAt | Date | TTL index for auto-cleanup |
| isRevoked | Boolean | Logout / security revocation |

**Indexes:** TTL on `expiresAt`, `{ userId, isRevoked }`

---

### 3.6 Departments

**Purpose:** Organizational hierarchy within a company.

| Field | Type | Notes |
|-------|------|-------|
| companyId | ObjectId | Required |
| code | String | Unique per company |
| parentDepartmentId | ObjectId | Nested departments |
| headEmployeeId | ObjectId | Department head |

**Indexes:** `{ companyId, code }` unique

---

### 3.7 Designations

**Purpose:** Job titles/levels within a company.

| Field | Type | Notes |
|-------|------|-------|
| companyId | ObjectId | Required |
| code | String | Unique per company |
| level | Number | Seniority ordering |

**Indexes:** `{ companyId, code }` unique, `{ companyId, level }`

---

### 3.8 Employees

**Purpose:** Core workforce record linked to a User account.

| Field | Type | Notes |
|-------|------|-------|
| companyId | ObjectId | Required |
| userId | ObjectId | Login account |
| employeeCode | String | Unique per company |
| departmentId, designationId | ObjectId | Org structure |
| reportingManagerId | ObjectId | Self-reference |
| employmentType | Enum | full_time, contract, etc. |
| status | Enum | active, terminated, etc. |
| personalInfo, contactInfo, bankDetails | Object | PII with `select: false` on sensitive fields |

**Indexes:** `{ companyId, employeeCode }` unique, `{ companyId, userId }` unique

---

### 3.9 Managers

**Purpose:** Manager-specific metadata beyond employee record.

| Field | Type | Notes |
|-------|------|-------|
| companyId | ObjectId | Required — managers belong to one company |
| employeeId | ObjectId | Links to Employee |
| departmentIds[] | ObjectId[] | Managed departments |
| directReportIds[] | ObjectId[] | Team members |

**Indexes:** `{ companyId, employeeId }` unique

---

### 3.10 Attendance

**Purpose:** Daily attendance tracking.

| Field | Type | Notes |
|-------|------|-------|
| companyId, employeeId | ObjectId | Required |
| date | Date | One record per employee per day |
| checkIn, checkOut | Date | Timestamps |
| status | Enum | present, absent, late, etc. |
| workHours | Number | Computed |

**Indexes:** `{ companyId, employeeId, date }` unique

**Scalability:** High write volume — consider date-range partitioning for reports

---

### 3.11 Leave Requests

**Purpose:** Leave application and approval workflow.

| Field | Type | Notes |
|-------|------|-------|
| companyId, employeeId | ObjectId | Required |
| leaveType | String | casual, sick, earned, etc. |
| startDate, endDate | Date | Leave period |
| status | Enum | pending, approved, rejected, cancelled |
| approvals[] | Array | Multi-level approval chain |

**Indexes:** `{ companyId, employeeId, status }`, `{ companyId, status, startDate }`

---

### 3.12 Payroll

**Purpose:** Monthly salary processing records.

| Field | Type | Notes |
|-------|------|-------|
| companyId, employeeId | ObjectId | Required |
| month, year | Number | Pay period |
| earnings[], deductions[] | Array | Salary components |
| grossPay, netPay | Number | Computed totals |
| status | Enum | draft, processed, paid |

**Indexes:** `{ companyId, employeeId, month, year }` unique

---

### 3.13 Documents

**Purpose:** File metadata for employee/company documents.

| Field | Type | Notes |
|-------|------|-------|
| companyId | ObjectId | Required |
| entityType, entityId | String, ObjectId | Polymorphic reference |
| fileUrl, mimeType, fileSize | — | File metadata |
| category | Enum | identity, tax, employment, etc. |

**Indexes:** `{ companyId, entityType, entityId }`

---

### 3.14 Notifications

**Purpose:** In-app notifications for users.

| Field | Type | Notes |
|-------|------|-------|
| companyId, userId | ObjectId | Scoped to user within company |
| type | Enum | info, warning, action_required |
| isRead | Boolean | Read status |
| expiresAt | Date | Optional TTL |

**Indexes:** `{ companyId, userId, isRead }`, TTL on `expiresAt`

---

### 3.15 Audit Logs

**Purpose:** Immutable activity trail for compliance.

| Field | Type | Notes |
|-------|------|-------|
| companyId, userId | ObjectId | Who did what |
| action | Enum | create, update, delete, login, etc. |
| entityType, entityId | — | What was affected |
| changes | Object | `{ before, after }` diff |
| requestId | String | Correlates with request logs |

**Indexes:** `{ companyId, createdAt }`, 2-year TTL auto-expiry

**Scalability:** Append-only; consider archival to cold storage after 2 years

---

### 3.16 Settings

**Purpose:** Per-company configuration key-value store.

| Field | Type | Notes |
|-------|------|-------|
| companyId | ObjectId | Required |
| category | Enum | general, attendance, leave, payroll, etc. |
| key | String | Setting identifier |
| value | Mixed | Any JSON-serializable value |
| isEncrypted | Boolean | For sensitive settings |

**Indexes:** `{ companyId, category, key }` unique

---

## 4. Request Lifecycle

```
Client Request
    │
    ▼
[Helmet / CORS / Compression]
    │
    ▼
[Body Parser + Request ID]
    │
    ▼
[Morgan → Winston request log]
    │
    ▼
[Route Matcher]
    │
    ▼
[Auth Middleware]          ← Phase 2
    │
    ▼
[Company Context]        ← Sets req.companyId from JWT
    │
    ▼
[Permission Check]       ← Phase 2
    │
    ▼
[Zod Validation]
    │
    ▼
[Controller]             ← Thin: parse, call service, respond
    │
    ▼
[Service]                ← Business logic
    │
    ▼
[Repository]             ← Data access with company scope
    │
    ▼
[MongoDB]
    │
    ▼
[Response Formatter]     ← { success, message, data, meta }
    │
    ▼
[Error Handler]          ← Catches all errors → standard format
```

---

## 5. Authentication Flow (High Level)

```
1. POST /auth/login
   → Validate credentials (email + password)
   → Verify user belongs to requested/default company
   → Generate access token (15m) + refresh token (7d)
   → Store hashed refresh token in Sessions collection
   → Return tokens + user profile + company list

2. Authenticated Requests
   → Bearer access token in Authorization header
   → Middleware verifies JWT, attaches req.user
   → Sets req.companyId from user.activeCompanyId
   → Permission middleware checks role permissions

3. POST /auth/refresh
   → Validate refresh token against Sessions
   → Issue new access token (rotate refresh if configured)

4. POST /auth/switch-company (Owner/HR only)
   → Verify user has access to target company
   → Update activeCompanyId on user + session
   → Issue new tokens with updated company context

5. POST /auth/logout
   → Revoke session (isRevoked = true)
```

**Future-ready:** 2FA fields on User model, email verification flags, OTP/SSO extension points in auth module.

---

## 6. API Response Format

### Success
```json
{
  "success": true,
  "message": "Employees retrieved",
  "data": [],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Validation Error (400)
```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": {
      "errors": [{ "field": "email", "message": "Invalid email" }]
    }
  }
}
```

### Auth Error (401)
```json
{
  "success": false,
  "message": "Token expired",
  "error": { "code": "TOKEN_EXPIRED" }
}
```

### Forbidden (403)
```json
{
  "success": false,
  "message": "Access denied",
  "error": { "code": "FORBIDDEN" }
}
```

---

## 7. How Future Modules Plug In

1. Create module folder under `src/modules/<name>/`
2. Define Mongoose model with `companyId` + plugins
3. Extend `BaseRepository` and `BaseService`
4. Add Zod schemas in `<name>.validation.js`
5. Implement thin controller methods
6. Define routes in `<name>.routes.js`
7. Register in `src/routes/index.js`:

```javascript
const employeeRoutes = require('../modules/employees/employee.routes');
router.use('/employees', authenticate, requireCompanyContext, attachCompanyScope, employeeRoutes);
```

---

## 8. Design Decisions & Tradeoffs

| Decision | Tradeoff |
|----------|----------|
| MongoDB over SQL | Flexible schema for HR data; no JOINs — denormalize carefully |
| companyId on every record | Storage overhead vs. simple, reliable isolation |
| Refresh tokens in DB | DB lookup on refresh vs. stateless (can't revoke stateless tokens) |
| No Redis | Simpler ops; session/cache in MongoDB is sufficient at this scale |
| PM2 cluster mode | Uses all CPU cores on VPS; shared nothing — sessions must be in DB |
| Daily rotating logs | Disk usage managed; no external log aggregator needed initially |
| Repository pattern | Extra abstraction layer vs. testability and consistent data access |

---

## 9. Scalability Considerations

**Current scale (2 companies, hundreds of employees):** Single VPS handles easily.

**Growth path:**
- **1K–10K employees:** Add MongoDB indexes for report queries; PM2 cluster sufficient
- **10K+ employees:** Consider read replicas for reporting; archive old audit/attendance data
- **Multi-region:** Not needed initially; companyId is natural shard key
- **File storage:** Move uploads to S3/Cloudflare R2 when disk becomes a constraint
- **Background jobs:** Add `node-cron` for payroll processing before considering message queues

**What we deliberately avoided:** Microservices, Redis, Kafka — operational cost exceeds benefit at current scale.

---

## 10. Production Deployment (Hostinger VPS)

```
Internet → Nginx (SSL, reverse proxy) → PM2 Cluster (Node.js) → MongoDB
```

- Nginx terminates SSL and proxies to `localhost:5000`
- PM2 runs `ecosystem.config.js` in cluster mode
- Logs in `./logs/` with 30-day rotation
- Uploads served from `./uploads/` (or Nginx static)

---

## 11. Phase 2 Roadmap

1. Auth module (login, refresh, logout, switch-company)
2. User & role management
3. Company seeding (Vytalix, Fiberise Fit)
4. Employee onboarding
5. Attendance, leave, payroll modules
