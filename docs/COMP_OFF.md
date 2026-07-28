# Compensatory Off (Comp-off)

## Eligibility rules

Same credit tiers:
| Duration | Credit |
|----------|--------|
| &lt; 1 hour | Not eligible |
| ≥ 1 hour and &lt; 4 hours | **0.5 day** |
| ≥ 4 hours | **1.0 day (full day)** |

### Weekly off (based on shift `workingDays`)

| Schedule | Can raise on |
|----------|----------------|
| **5-day** Mon–Fri `[1,2,3,4,5]` | **Saturday and Sunday only** |
| **6-day** Mon–Sat `[1,2,3,4,5,6]` | **Sunday only** |

Duration = **punch-in → punch-out** (hours worked that day).

Example (FR0003, 5-day): punch in **11:00 AM**, punch out **4:00 PM** on Saturday or Sunday → **5 hours** → **1.0 day** full comp-off.

### Weekdays (working day)

Duration = **shift end → last punch-out** (overtime after shift).  
Leaving before shift end (e.g. out at 3:51 PM, shift ends 6:00 PM) → **0m OT** → not eligible.

Punch in/out is allowed on weekly offs so employees can work Sat/Sun (or Sun) and raise comp-off.

## APIs

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/comp-off/eligibility?date=` | Preview (`durationMinutes`, `durationDisplay`, `message`, `isWeeklyOff`, …) |
| `POST` | `/comp-off` | Raise `{ date?, reason }` |
| `PUT` | `/comp-off/:id/approve` | Approve + credit `COMP_OFF` |
| `PUT` | `/comp-off/:id/reject` | Reject |
| `PUT` | `/comp-off/:id/cancel` | Cancel pending |
