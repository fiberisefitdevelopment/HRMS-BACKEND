# Attendance Management — Phase 4

## Attendance Engine

Policy-driven orchestration — no hardcoded rules.

```
Punch In → Load Policy + Shift → Check Working Day
         → Geofence Engine (if enabled)
         → Regularization Engine → Late Engine → Create Record

Punch Out → Geofence Engine (if enabled)
          → Calculate Working Hours → Determine Status

Break → Break Engine validates → Update Record
```

## Working Hour Calculation

```
Gross = punchOut - punchIn
Break = lunch + tea1 + tea2 durations
Net = Gross - Break

Net >= policy.workingHours.fullDayMinutes → Present
Net >= policy.workingHours.halfDayMinutes → Half Day
Else → Absent
```

## Regularization Engine

```
IF punchIn within policy.regularization.window:
  counter = monthly count + 1
  IF counter <= policy.regularization.monthlyLimit:
    status = regularized
  ELSE:
    status = policy.regularization.exceedingAction (half_day)
Counter resets each calendar month.
```

## Shift Engine

Employees assigned to shifts via `employee_shift_assignments`.
Shift timings override policy defaults for start/end/grace/breaks.

## Break Engine

Types: `lunch`, `tea_break_1`, `tea_break_2`
Prevents duplicate start/end. Validates punch-in exists first.

## Geofencing

HR configures office geofences per company (`/api/v1/geofences`) and enables enforcement on the attendance policy.

```
policy.geofencing.enabled = true
→ punch-in / punch-out require latitude + longitude
→ allowed if distance to ANY active office <= radiusMeters
→ otherwise hard reject (403)
→ source "manual" and attendance corrections bypass geofence

policy.geofencing.applyToAllEmployees = true (default)
→ enforce for every employee in the company

policy.geofencing.applyToAllEmployees = false
→ enforce only for employeeProfileIds listed on the policy
→ employees not in the list punch without GPS / fence checks
```

Update via `PUT /attendance-policies`:
```json
{
  "geofencing": {
    "enabled": true,
    "enforceOnPunchIn": true,
    "enforceOnPunchOut": true,
    "applyToAllEmployees": false,
    "employeeProfileIds": ["64f...", "64f..."]
  }
}
```

Location heartbeat (`POST /attendance/location`) updates `lastKnownLocation` while punched in (not hard-gated) so managers can see live team positions.

Manager live view: `GET /attendance/dashboard/manager/live`

## Attendance Status Engine

Statuses: present, late, regularized, half_day, absent, week_off, holiday, leave, missing_punch, auto_punch_out

## Database Relationships

```
Company → CompanyAttendancePolicy (1 default, includes geofencing toggle)
Company → OfficeGeofence (many)
Company → Shift (many)
EmployeeProfile → EmployeeShiftAssignment → Shift
EmployeeProfile → AttendanceRecord (daily, stores punch GPS + lastKnownLocation)
EmployeeProfile → RegularizationCounter (monthly)
```

## API Flow

```
POST /attendance/punch-in              → { source?, latitude?, longitude?, accuracyMeters? }
POST /attendance/punch-out             → { source?, latitude?, longitude?, accuracyMeters? }
POST /attendance/location              → Heartbeat while punched in
POST /attendance/break/start           → { breakType: "lunch" }
POST /attendance/break/end             → { breakType: "lunch" }
GET  /attendance/today                 → Today's record + timer
GET  /attendance/dashboard/*           → Role-based dashboards
GET  /attendance/dashboard/manager/live → Team live status + locations
GET  /attendance/reports/:type         → Reports
GET  /attendance/export/:type          → Excel/CSV export
GET/PUT /attendance-policies           → Company policy (includes geofencing)
CRUD /geofences                        → Office geofence management
POST /geofences/validate               → Preview: am I inside?
CRUD /shifts                           → Shift management
POST /shifts/assign                    → Assign employee to shift
```

## Seeded Data

**Vytalix:** General, Sales, Production shifts + regularization 09:15-09:30 AM
**Fiberise:** General, Sales shifts + regularization 09:30-11:00 AM + daily wage buffer
**Both companies:** Shared HQ geofence sample (same lat/lng, separate records); geofencing disabled by default until HR enables it

## Auto Punch Out

Cron job runs every 5 minutes. When current time >= policy.autoPunchOut.time, pending records are auto punched out with audit log.
