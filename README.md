# Felicity Event Management System (MERN)

Centralized event platform for Felicity with role-based workflows for participants, organizers, and admin.

## Directory Structure

```text
2024101032/
|-- backend/
|-- frontend/
|-- README.md
|-- deployment.txt
```

## Advanced Feature Selection (Part 2)

Implemented exactly `2 + 2 + 1` as required:

- Tier A (2 features, 8 marks each)
  - Merchandise Payment Approval Workflow
  - QR Scanner and Attendance Tracking
- Tier B (2 features, 6 marks each)
  - Real-Time Discussion Forum
  - Organizer Password Reset Workflow
- Tier C (1 feature, 2 marks)
  - Add to Calendar Integration

## Libraries and Justification

### Backend (`backend/package.json`)

- `express`: REST API routing and middleware composition.
- `mongoose`: schema modeling, validation, indexes, and MongoDB query abstraction.
- `bcryptjs`: secure password hashing (no plaintext storage).
- `jsonwebtoken`: stateless JWT auth for protected endpoints.
- `express-validator`: request payload validation at route layer.
- `cors`: controlled cross-origin access from frontend.
- `helmet`: secure HTTP headers.
- `cookie-parser`: request cookie parsing support.
- `morgan`: API request logging for debugging/ops.
- `multer`: multipart file uploads (payment proofs and custom form file fields).
- `qrcode`: ticket QR generation.
- `nanoid`: collision-resistant ticket IDs.
- `nodemailer`: transactional ticket email delivery (with safe dev fallback).
- `socket.io`: real-time discussion forum messaging/presence/typing events.
- `csv-stringify`: participants/attendance export CSV generation.
- `dotenv`: environment variable loading.
- `nodemon` (dev): autoreload backend during development.

### Frontend (`frontend/package.json`)

- `react`: component-driven UI.
- `react-router-dom`: role-based route navigation and protected pages.
- `axios`: API client with interceptor-based JWT injection.
- `dayjs`: date formatting in dashboards/details pages.
- `socket.io-client`: real-time discussion forum.
- `html5-qrcode`: camera/file QR scanning for attendance.
- `vite`: fast dev server and production bundling.
- `@vitejs/plugin-react`: Vite React integration.

## Core Requirement Coverage (Part 1)

### Authentication and Security

- Participant signup/login with IIIT domain validation for `participantType=iiit`.
- Organizer self-registration disabled; accounts are admin-provisioned only.
- Admin account bootstrapped by backend environment config.
- Bcrypt password hashing in user model pre-save hook.
- JWT auth middleware and role authorization middleware.
- Frontend role-based protected routes for all pages except login/signup.
- Session persistence via localStorage token/user and explicit logout token clear.

### Participant Features

- Onboarding preferences (interests + followed organizers) with skip support.
- Preferences editable later from profile page.
- Preference-aware event ordering (followed organizer + interest tag scoring).
- Dashboard with upcoming registrations and history tabs:
  - Normal
  - Merchandise
  - Completed
  - Cancelled/Rejected
- Browse events with search (partial/fuzzy), filters, followed-only, and trending top 5 (24h).
- Event details with registration blocking conditions:
  - status closed/not published
  - deadline passed
  - normal-event registration cap reached
  - merchandise out-of-stock
- Normal registration with dynamic-form validation and ticket generation.
- Merchandise purchase flow with pending payment approval and proof upload.
- Ticket/QR display and participation history visibility.
- Clubs listing with follow/unfollow and organizer detail page (upcoming/past events).
- Profile edit fields and password change flow.

### Organizer Features

- Dashboard carousel with event statuses and completed-event analytics.
- Event create draft -> edit -> publish lifecycle.
- Status-based edit restrictions across draft/published/ongoing/completed/closed.
- Custom form builder for normal events with:
  - supported field types (`text`, `textarea`, `number`, `email`, `dropdown`, `checkbox`, `radio`, `file`, `date`)
  - required/optional field control
  - option entry for option-based fields
  - field reordering
- Form lock behavior after registrations (cannot edit custom form in published+ states).
- Event detail analytics and searchable participant table with CSV export.
- Organizer profile editing + Discord webhook event announcements.
- Ongoing event attendance tools:
  - camera/file/manual QR scan
  - duplicate rejection
  - manual override
  - scanned vs not-scanned dashboard
  - attendance CSV export

### Admin Features

- Dashboard metrics for users/events/registrations/reset requests.
- Organizer account creation with auto-generated login email + strong password.
- Organizer account actions:
  - disable/enable
  - archive
  - permanent delete
- Organizer password reset request review with approve/reject + admin comments.

## Advanced Features Design and Implementation

### Tier A-1: Merchandise Payment Approval Workflow

#### Why selected

- Adds realistic payment verification control and avoids auto-confirming fraudulent orders.

#### Design choices

- Purchase creates a `Registration` in `pending_approval` with `paymentStatus=pending`.
- Payment proof file required at submission time.
- Organizer reviews pending entries and decides `approved` or `rejected`.
- Stock decremented only on approval.
- Ticket/QR/email generated only on approval.
- Rejected/pending orders do not get ticket IDs.

#### Technical decisions

- Proofs stored via Multer under `/uploads/payment-proofs`.
- Approval route updates review metadata (`reviewedBy`, `reviewedAt`, comment).
- Metrics recalculated after each review decision.

### Tier A-2: QR Scanner and Attendance Tracking

#### Why selected

- Converts ticket verification into operational check-in tooling with auditability.

#### Design choices

- Accept QR scans from device camera and file upload.
- Manual ticket code scan and manual override for edge cases.
- Duplicate scan detection with conflict response.
- Attendance dashboard separates scanned and not-yet-scanned.
- Full audit log for marked/duplicate/rejected/override actions.

#### Technical decisions

- Ticket payload includes stable ticket code and related IDs.
- `AttendanceLog` stores scanner identity, method, action, reason, and timestamp.
- Attendance export generated as CSV.

### Tier B-1: Real-Time Discussion Forum

#### Why selected

- Handles live event Q&A and organizer communication in a single event context.

#### Design choices

- Access control: registered participant, event organizer, or admin only.
- Real-time messaging with message reactions.
- Organizer/admin moderation:
  - pin/unpin
  - delete
  - announcement posts
- Threading via `parentId` replies.
- Presence/typing/new-message notification indicators in UI.

#### Technical decisions

- Socket rooms keyed by `event:<eventId>`.
- JWT-verified socket handshake.
- REST + socket hybrid: durable writes over HTTP, live fan-out over sockets.

### Tier B-2: Organizer Password Reset Workflow

#### Why selected

- Matches assignment constraint that organizer resets are admin-handled.

#### Design choices

- Organizer submits reset request with reason.
- Admin reviews pending requests and applies approve/reject decision with comment.
- On approval, system auto-generates strong password and returns to admin panel.
- Organizer sees request history and status lifecycle.

#### Technical decisions

- Dedicated `PasswordResetRequest` model for auditable workflow states.
- Strong password generator ensures mixed-case, numeric, and special characters.

### Tier C-1: Add to Calendar Integration

#### Why selected

- Improves participation retention and schedule adherence with low UX friction.

#### Design choices

- Ticket-based calendar links endpoint.
- Supports:
  - Google Calendar deep link
  - Outlook deep link
  - `.ics` download

#### Technical decisions

- ICS content generated server-side with UTC-safe formatting.
- Links generated per ticket to enforce authorized access.

## Additional Data Attributes and Justification

- `User.discordWebhook`: enables organizer Discord auto-post integration.
- `Event.status`: lifecycle state machine for edit rules and visibility.
- `Event.totalRegistrations/totalSales/totalRevenue/totalAttendance`: dashboard analytics.
- `Event.customFormFields.options/order`: supports option-based fields and reordering.
- `Registration.payment*` fields: pending/approved/rejected payment verification lifecycle.
- `Registration.dynamicResponses`: stores flexible custom-form submissions.
- `Ticket.qrPayload/qrDataUrl`: QR-based gate validation and UI display.
- `AttendanceLog`: audit-proof attendance actions and manual overrides.
- `DiscussionMessage.parentId/isPinned/reactions/isAnnouncement`: threaded/moderated forum.
- `PasswordResetRequest` resolution fields: admin workflow traceability.

## Local Setup

### Prerequisites

- Node.js 18+
- MongoDB local or Atlas

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Default backend URL: `http://localhost:5000`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Default frontend URL: `http://localhost:5173`

## Required Environment Variables

### Backend

- `MONGODB_URI`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Also supported:

- `JWT_EXPIRES_IN`
- `FRONTEND_URL`
- `IIIT_EMAIL_DOMAIN`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `UPLOAD_DIR`
- `MAX_UPLOAD_SIZE_MB`

### Frontend

- `VITE_API_BASE_URL` (default `/api`)
- `VITE_SOCKET_URL` (default `http://localhost:5000`)

## Scripts

### Backend

- `npm run dev`: run with nodemon
- `npm start`: run production server

### Frontend

- `npm run dev`: Vite dev server
- `npm run build`: production build
- `npm run preview`: preview built output

## Deployment Notes

- Root-level `deployment.txt` includes frontend and backend URLs as required.
- MongoDB Atlas should be connected via environment variable in deployed backend.
