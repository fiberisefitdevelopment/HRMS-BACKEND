# HRMS Backend

Production-grade HRMS backend foundation — modular monolith for multi-company workforce management.

**Stack:** Node.js · Express · MongoDB · Mongoose · JWT · Zod · Winston

---

## Quick Start

```bash
cp .env.example .env
npm install
npm run dev
```

**Default owner credentials** (from `.env`):
- Email: `owner@hrms.local`
- Password: `Owner@12345`

Health check: `GET /api/v1/dashboard/health`  
Login: `POST /api/v1/auth/login`

See [docs/AUTH.md](./docs/AUTH.md) for authentication documentation.  
See [docs/ORGANIZATION.md](./docs/ORGANIZATION.md) for organization management (Phase 3).  
See [docs/ATTENDANCE.md](./docs/ATTENDANCE.md) for attendance management (Phase 4).  
Import [Auth Postman](./docs/postman/HRMS-Auth.postman_collection.json) | [Organization Postman](./docs/postman/HRMS-Organization.postman_collection.json) | [Attendance Postman](./docs/postman/HRMS-Attendance.postman_collection.json)

Production: `npm run prod` (requires PM2)

---

## Architecture

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for full design documentation.

---

## Project Structure

```
src/
├── config/           # Centralized configuration
├── database/         # Connection, models registry, plugins
├── middlewares/      # Cross-cutting request middleware
├── constants/        # App-wide constants
├── helpers/          # Response formatters, password utils
├── utils/            # ApiError, pagination, catchAsync
├── shared/           # Base repository/service, module registry
├── modules/          # Feature modules (auth, employees, etc.)
├── routes/           # Route aggregator
├── app.js            # Express application setup
└── server.js         # Entry point
```

Each module contains: `routes`, `controller`, `service`, `repository`, `model`, `validation`.

---

## Environment Variables

See `.env.example` for all required variables.

---

## License

UNLICENSED — Private
