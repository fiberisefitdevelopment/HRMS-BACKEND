# Authentication & Authorization — Phase 2

## Authentication Flow

```
1. Client POST /auth/login { email, password }
2. Server validates credentials via Zod
3. Server checks: user exists → not blocked → not locked → password match → isActive
4. On failure: increment failedLoginAttempts, lock after 5 attempts (30 min)
5. On success: reset attempts, update lastLogin, create Session, issue JWT pair
6. Audit log: login / failed_login
7. Response: { user, tokens: { accessToken, refreshToken } }
```

## JWT Flow

**Access Token (15 min)**
```json
{
  "sub": "userId",
  "email": "user@example.com",
  "companyId": "activeCompanyId",
  "roleId": "roleId",
  "roleSlug": "owner",
  "refreshTokenVersion": 0,
  "sessionId": "sessionId",
  "type": "access"
}
```

**Refresh Token (7 days)** — same payload with `type: "refresh"`

- `companyId` comes from the user's active company in the database — never from the request body on protected routes
- `refreshTokenVersion` invalidates all tokens when incremented (password change, refresh rotation, block)

## Refresh Token Flow

```
1. Client POST /auth/refresh { refreshToken }
2. Verify JWT signature + expiry + type
3. Load user → check not blocked/inactive/locked
4. Verify refreshTokenVersion matches user record
5. Hash token → find active Session → verify sessionId
6. Revoke old session
7. Increment refreshTokenVersion on user
8. Create new session + issue new token pair
9. Old refresh token is permanently invalid (rotation)
```

## RBAC Flow

```
Request → authenticate middleware
       → Load user + role + permissions
       → requireRole('owner', 'hr') OR requirePermission('employee.create')
       → Owner bypasses permission checks (full access)
       → Other roles: permission slug must exist in role.permissions
       → 403 if unauthorized
```

| Role | Access |
|------|--------|
| Owner | Full access to all companies |
| HR | HR features + company switch |
| Manager | Team management features |
| Employee | Self-service only |

## Permission Flow

Permissions are global system records (e.g. `employee.create`, `leave.approve`).

Roles reference permission ObjectIds. Users inherit permissions through `roleId`.

Middleware: `requirePermission('user.block', 'user.activate')` — all listed permissions required.

## Company Switching Flow

```
1. Only Owner and HR roles (requirePermission: company.switch)
2. POST /auth/switch-company { companyId }
3. Validate company exists and is active
4. Owner: can switch to any active company
5. HR: companyId must be in user.accessibleCompanyIds
6. Update user.companyId in database
7. Issue fresh JWT pair with new companyId
8. Audit log: company_switch
```

Managers and Employees receive 403 on switch-company.

## Account Blocking Flow

```
POST /users/block { userId, reason }
  → Actor must have user.block permission
  → Owner can block: HR, Manager, Employee (not self, not Owner)
  → HR can block: Manager, Employee (not HR, not Owner)
  → Sets isBlocked=true, status=suspended, revokes all sessions
  → Audit log: block

POST /users/unblock { userId }
  → Actor must have user.activate permission
  → Same role hierarchy rules apply
  → Sets isBlocked=false, status=active, clears lock state
  → Audit log: activate
```

## Folder Structure (Phase 2)

```
src/modules/auth/
  auth.constants.js    # Permissions, roles, seed data, block rules
  auth.validation.js   # Zod schemas
  auth.repository.js   # User + Session data access
  auth.service.js        # Login, refresh, switch, password logic
  auth.controller.js     # Thin HTTP handlers
  auth.routes.js         # Route definitions
  session.model.js       # Refresh token sessions

src/modules/users/
  user.model.js          # User schema
  user.validation.js     # Block/unblock schemas
  user.service.js        # Block/unblock business logic
  user.controller.js
  user.routes.js

src/middlewares/
  auth.middleware.js     # JWT validation, load user context
  rbac.middleware.js     # requireRole()
  permission.middleware.js # requirePermission()

src/database/seeders/
  index.js               # Auto-seed roles, permissions, companies, owner
```

## Default Credentials

Set in `.env`:

```
SEED_OWNER_EMAIL=owner@hrms.local
SEED_OWNER_PASSWORD=Owner@12345
```

## Forgot / Reset Password (Prepared)

Schemas exist in `auth.validation.js` (`forgotPasswordSchema`, `resetPasswordSchema`).

Phase 3 will add:
- `POST /auth/forgot-password` → generate reset token, send email
- `POST /auth/reset-password` → validate token, set new password, increment refreshTokenVersion

## API Endpoints

| Method | Endpoint | Auth | Permission |
|--------|----------|------|------------|
| POST | /auth/login | No | — |
| POST | /auth/refresh | No | — |
| POST | /auth/logout | Yes | — |
| GET | /auth/me | Yes | — |
| POST | /auth/change-password | Yes | — |
| POST | /auth/switch-company | Yes | company.switch |
| POST | /users/block | Yes | user.block |
| POST | /users/unblock | Yes | user.activate |
| GET | /roles | Yes | role.read |
| GET | /permissions | Yes | permission.read |
