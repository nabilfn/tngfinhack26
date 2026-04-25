# Face2Go – AI-Powered Biometric Payment Authorization Layer

Face2Go is a database-backed fintech prototype that follows this core flow:

1. User signs up or logs in.
2. User lands on dashboard with wallet balance, latest transaction, and Face2Go enrollment status.
3. User creates a transaction with recipient and amount.
4. User chooses Touch 'n Go wallet payment or Face2Go biometric payment.
5. Face2Go captures a live camera image and sends it to the backend.
6. Backend compares the captured image with the enrolled image using AWS Rekognition.
7. If confidence is high enough, the transaction is approved.
8. If confidence is below threshold, the user uses the fallback passcode.
9. Result and transaction history are read from PostgreSQL.

## What changed in this stable version

- Removed hardcoded frontend login values and transaction defaults.
- Removed demo face bypass logic.
- Added live camera capture for signup enrollment and Face2Go verification.
- Made transaction method nullable while transaction is still pending.
- Added backend-only transaction approval with balance checks.
- Added Docker startup database sync using Prisma `db push`.
- Fixed Prisma/OpenSSL compatibility by using Debian slim backend image.
- Fixed Tailwind to stable v3 configuration.
- Added `.dockerignore` files so Docker does not copy `node_modules`.
- Added optional environment-driven seed only; no hardcoded users are inserted unless configured.

## Run locally

```bash
docker-compose down
docker-compose up --build
```

Open:

```text
Frontend: http://localhost:3000
Backend health: http://localhost:4000/health
PostgreSQL host port: 5433
```

## Important AWS Rekognition setup

Face2Go verification requires AWS Rekognition credentials in `backend/.env`:

```env
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
REKOGNITION_THRESHOLD=95
```

Without these credentials, normal signup/login/dashboard/TNG payment still works, but Face2Go verification returns a clear configuration error.

## Optional local seed user

By default, no seed user is created. To seed one local user, set these in `backend/.env`:

```env
AUTO_SEED=true
SEED_USER_EMAIL=your@email.com
SEED_USER_NAME=Your Name
SEED_USER_PASSWORD=yourpassword
SEED_USER_PASSCODE=123456
SEED_USER_BALANCE=200
```

Then rebuild or restart backend.

## Core API

```text
POST /api/auth/signup
POST /api/auth/login
GET  /api/dashboard
POST /api/transactions/create
POST /api/transactions/pay/tng
POST /api/transactions/pay/face2go
POST /api/transactions/passcode/verify
GET  /api/transactions/history
GET  /api/transactions/:id/result
```

## Notes

Camera access works on `localhost` or HTTPS only. If testing on a deployed server, use HTTPS.
