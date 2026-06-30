# Hadaf United Academy — Backend API

Express + MongoDB backend for أكاديمية هدف يونايتد.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your MongoDB URI and session secret
```

## Run

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `SESSION_SECRET` | Secret for session encryption |
| `PORT` | Port to listen on (default: 3000) |
| `ADMIN_USERNAME` | Initial super admin username |
| `ADMIN_PASSWORD` | Initial super admin password |

## API Routes

| Method | Route | Auth Required |
|--------|-------|---------------|
| POST | `/api/auth/login` | No |
| GET | `/api/auth/me` | No |
| POST | `/api/auth/logout` | No |
| GET/POST | `/api/players` | Yes |
| GET/PATCH/DELETE | `/api/players/:id` | Yes |
| GET/POST | `/api/subscriptions` | Yes |
| GET | `/api/subscriptions/expiring-soon` | Yes |
| GET/PATCH/DELETE | `/api/subscriptions/:id` | Yes |
| POST | `/api/subscriptions/:id/pay` | Yes |
| GET/POST | `/api/employees` | Yes |
| GET/PATCH/DELETE | `/api/employees/:id` | Yes |
| GET/POST | `/api/salaries` | Yes |
| DELETE | `/api/salaries/:id` | Yes |
| GET/POST | `/api/expenses` | Yes |
| PATCH/DELETE | `/api/expenses/:id` | Yes |
| GET | `/api/dashboard/summary` | Yes |
| GET | `/api/dashboard/finance-summary` | Yes |
| GET/POST | `/api/admin-accounts` | Yes |
| PATCH/DELETE | `/api/admin-accounts/:id` | Yes |
| GET/PUT | `/api/settings` | Yes |
| POST | `/api/registrations` | No |
| GET | `/api/registrations` | Yes |
| PATCH | `/api/registrations/:id` | Yes |
| PATCH | `/api/registrations/:id/status` | Yes |
| DELETE | `/api/registrations/:id` | Yes |
