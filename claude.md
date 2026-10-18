# Practice Scheduler: Build Specification

Audience: a coding agent (Antigravity). Read this whole file before writing code.
Reference UI prototype: `calendar.html` (single file, vanilla JS). Match its interaction model: drag to move, pull the bottom edge to extend, hatched buffer, guest view.

---

## 0. Instructions to the coding agent

1. Work in the phases in section 14. Finish and test one phase before starting the next. Commit after each.
2. Do not invent facts about the payment verifier. Read its docs at `https://verify.leul.et/docs` and the repo `https://github.com/Vixen878/verifier-api` before writing the client. Its README is the source of truth for request and response shapes, required fields per bank, and the exact endpoint names.
3. Anything marked **[OPEN]** in section 15 has a default. Use the default, put it behind a setting or constant, and list it in `DECISIONS.md` so the owner can change it.
4. Never log client names, phone numbers, emails, notes or receipt contents. Log IDs only.
5. Keep it simple. One practitioner, one server, one database. No microservices, no queues beyond an in-process scheduler.
6. If a requirement here conflicts with what is technically possible on iPhone Safari, stop and write the conflict in `DECISIONS.md` instead of silently working around it.
7. Do not collect or store any health information (no clinical notes, no reason for visit). See section 10.

---

## 1. Product summary

A booking and light client-management app for one psychologist in Ethiopia (in-person sessions only, Ethiopian clients only).

- **Public side:** a landing page and a booking page. New clients see free and taken slots, choose a 60 or 90 minute slot, enter display name, phone and email, accept terms, pay a non-refundable scheduling fee by bank or mobile money transfer, submit the transaction reference, and are confirmed automatically once the payment is verified.
- **Private side (her PWA):** a clean drag-and-drop calendar, a client list, payment log and income dashboard, and settings. It runs on her iPhone as an installed PWA (no App Store, no developer account).

The owner (psychologist) is the only user. No roles, no staff accounts.

## 2. Principles

- Simple to use above all. If a screen needs explaining, simplify it.
- Privacy first: guests never see anything about other clients; session notes are encrypted.
- Mobile first. Many clients are on slow connections and low-end Android phones. Keep the public pages light (target under 150 KB transferred for the booking page, no heavy frameworks on the landing page).
- English only.
- Money is stored as integer santim (1 ETB = 100 santim). Currency is ETB. Never use floats for money.

## 3. Tech stack

- Node.js 20+ with TypeScript.
- Server: Fastify. Validation with zod. Cookie sessions.
- Database: SQLite via `better-sqlite3`, with a migration tool (Drizzle or Kysely). WAL mode on.
- Admin app: React + Vite, `vite-plugin-pwa`. Calendar: FullCalendar (`timegrid`, `interaction`).
- Public pages: server-rendered or static HTML plus a small script for the booking flow. Do not ship the admin bundle to public visitors.
- Email: Nodemailer over SMTP (provider configurable by env). Templates are plain, neutral text.
- Web push: `web-push` with VAPID keys.
- Scheduler: `node-cron` (in-process), runs every minute.
- Passwords: argon2id.
- Tests: Vitest. Payment verifier is mocked in tests.
- Deploy: Docker image, single container, persistent volume for the SQLite file and receipt screenshots.

Everything is configured by environment variables (`.env.example` required): `BASE_URL`, `SESSION_SECRET`, `SMTP_*`, `VAPID_*`, `VERIFIER_BASE_URL`, `VERIFIER_API_KEY`, `DATA_DIR`, `TURNSTILE_SECRET` (optional).

## 4. Time and calendars

- Store all timestamps in UTC. Display in `Africa/Addis_Ababa` (UTC+3, no daylight saving).
- The grid is Gregorian. Under each day number, show the Ethiopian date using `Intl.DateTimeFormat('en-u-ca-ethiopic', ...)`. The admin can toggle which calendar is the primary heading.
- Use Latin-script month names (for example "Meskerem").
- Ethiopian public holidays block bookings. Do not hardcode them as final. Ship a preloaded editable list; the admin has a Holidays screen to add, remove, or shift dates (moveable holidays change every year). A blocked day shows "Off" to admin and "unavailable" to guests.
- The week starts on Monday.

## 5. Data model

All tables have `id` (integer primary key) and `created_at`. Use foreign keys with explicit `ON DELETE` behaviour.

| Table                | Key fields                                                                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin`              | email (unique), password_hash, notes_key_salt, notes_key_check                                                                                                                                                                                                |
| `settings`           | single JSON row (see section 6)                                                                                                                                                                                                                               |
| `payment_accounts`   | provider (`telebirr`, `cbe`, `cbebirr`, `dashen`, `abyssinia`), account_number, holder_name, active                                                                                                                                                           |
| `holidays`           | date, name, active                                                                                                                                                                                                                                            |
| `blocks`             | start_utc, end_utc, reason (her own time off)                                                                                                                                                                                                                 |
| `clients`            | public_id (`C-0001`, unique, sequential), display_name, phone_e164 (unique), email, is_verified (bool, set only by her), guardian_name (nullable), note (plain text, max 280 chars, no health info), booking_token (random, for verified clients), deleted_at |
| `session_changes`    | session_id, from_start_utc, to_start_utc, by (`client`, `admin`), at                                                                                                                                                                                          |
| `series`             | client_id, weekday, start_local_time, duration_min, starts_on, ends_on (nullable), active                                                                                                                                                                     |
| `sessions`           | client_id, series_id (nullable), start_utc, duration_min, status, source (`public`, `manual`, `series`), fee_due_cents, fee_waived (bool), hold_expires_at, original_start_utc, consent_accepted_at, consent_version                                          |
| `payments`           | session_id (nullable for unapplied payments), provider, reference, amount_cents, receiver_account, paid_at, verified (bool), method (`auto`, `manual`), raw_response_json, screenshot_path, UNIQUE(provider, reference)                                       |
| `push_subscriptions` | endpoint, keys_json                                                                                                                                                                                                                                           |
| `reminders`          | session_id, due_at, notified_at, sent_at, channel (`email`, `sms`)                                                                                                                                                                                            |
| `audit_log`          | at, actor, action, entity, entity_id (no personal data)                                                                                                                                                                                                       |

Session statuses: `held`, `awaiting_payment`, `confirmed`, `attended`, `no_show`, `cancelled`, `expired`, `needs_review`.

## 6. Admin settings (all editable in the UI)

- Hourly rate (ETB).
- Scheduling fee percent of the hourly rate (default 25). Fee in ETB = hourly rate x (duration / 60) x percent, rounded to the nearest birr, so a 90 minute session has a fee 1.5x that of a 60 minute one.
- Session durations offered: 60 and 90 minutes (90 adds 30 minutes and the fee scales with duration).
- Buffer between sessions (default 10 minutes).
- Weekly working hours per weekday.
- Booking horizon (default 30 days) and minimum notice (default 0: an open slot can be booked until it starts; see the late-booking notice in section 7).
- Hold duration for unpaid slots (default 20 minutes, never longer than the time left until the slot starts).
- Receiving payment accounts.
- Location text (address and directions, shown in confirmations). Default placeholder: Bulgaria area, near the African Union, Addis Ababa; she enters the exact address.
- Branding: practice name, logo, accent colour, photo, bio, FAQ (see section 12).
- Verified-client change policy: minimum lead time 7 days, reschedule window 4 weeks.
- Consent text (editable, versioned, with a simple default).
- Intake: display name, phone, email, and parent or guardian name when booking for someone under 18. No health information or reason for visit is collected.
- Holidays and personal blocks.

## 7. Public booking flow

1. **Slot picker.** Guests see free slots for the next 30 days. A taken or blocked slot just looks unavailable. No names, no hints. Slot generation respects working hours, holidays, blocks, buffer, minimum notice, and horizon.
2. **Choose duration** (60 or 90). The slot list updates (a 90 minute choice needs room for the buffer).
3. **Details.** Display name (what they want to be called), phone (Ethiopian format, normalised to +251), email, parent or guardian name if booking for a minor, and required checkboxes: terms accepted, and "I understand the scheduling fee is non-refundable".
4. **Hold.** On submit, create the client (or match by phone) and the session with `held` status and `hold_expires_at` (20 minutes, or the slot start time if sooner). The hold is enforced in a single database transaction with a uniqueness guard so two people cannot hold the same slot.
5. **Pay.** Show the fee, the accepted receiving account(s) with the account holder name, and a countdown for the hold. The client pays in their own banking or Telebirr app.
6. **Submit proof.** The client enters the transaction reference and chooses the provider, and optionally uploads a screenshot (jpeg or png, max 5 MB). The screenshot is always stored for manual review.
7. **Verify** (section 8). Result states: confirmed, short (tell them how much is still due), failed (reason), or pending review.
8. **Confirmation.** Show a confirmation page with date, time, location, and an `.ics` download. Send a confirmation email.

**Late bookings.** Minimum notice is 0: an open slot can be booked until it starts, and the client comes to her address. When a slot starts soon (setting, default within 3 hours), show a prominent notice before payment with the start time, the full address, and "Only book if you can arrive on time. The fee is non-refundable." **[OPEN: owner's wording was cut off]**

**New clients** can only book by paying. They cannot reschedule or cancel. Returning clients who are not verified pay the fee on every booking.

## 7b. Verified clients (weekly clients)

Only she can mark a client as verified (a toggle on the client page). Verified clients have no fee and get a private link (`booking_token`). Phone numbers alone never unlock anything.

- The link shows only that client's upcoming sessions. They cannot book extra sessions, hold slots, or see anything else.
- Each weekly session is handled independently. Changing one occurrence never changes the series.
- A verified client may move an occurrence to any free slot within the next 4 weeks, but only if the original session is more than 7 days away. Within 7 days, no changes: the link shows a message to contact her.
- There is no plain cancellation. A "cancel" request leads into the same reschedule step: the client must choose a new time. This is so she knows ahead of time.
- The target slot is validated with the same rules as the public booking (working hours, buffer, holidays, blocks). It applies immediately when valid. She gets a push and a Today item, the client gets a confirmation email, and the change is logged in `session_changes`. **[OPEN: approve first?]**
- The client page shows verified status and the reschedule history.

## 8. Payment verification (core logic)

The verifier API only confirms that a receipt exists and reports its details. It does not know our fee. Our server does the business logic.

For each submitted reference, in order:

1. Reject if `(provider, reference)` already exists in `payments` (replay protection).
2. Call the verifier for that provider using the endpoint and parameters in its docs. Handle timeouts (10 s) and treat any non-success response as "unverified".
3. Check the receiver: account number and/or holder name must match one of the active `payment_accounts`. Reject otherwise.
4. Check the receipt date is not earlier than the time the hold was created. Reject otherwise.
5. Record the verified amount.
6. **Sum all verified payments on this session.**
   - Sum < fee due: status stays `awaiting_payment`. Return "You have paid X of Y. Send the remaining Z and enter that reference too." Keep the hold alive until it expires.
   - Sum >= fee due: set `confirmed`. If the sum exceeds the fee, flag the overpayment for her (visible in the payment log). No automatic refund.
7. If the hold has expired, do not confirm the booking: the client must start a new booking. Never lose the money trail: record the verified receipt as an unapplied payment (`session_id` null) linked to the client, show it in her needs-attention list, and let her decide what to do. **[OPEN]**

If the verifier is unavailable or cannot read the receipt, set `needs_review` and keep the screenshot. The admin screen shows each pending item with the screenshot and the typed reference, and a **Confirm manually** button that records `method = manual`.

Wrap the verifier in a thin interface (`verifyReceipt(provider, reference, extra)`) so it can be swapped, mocked, or self-hosted.

## 9. Admin PWA

Screens, in this navigation order: **Today**, **Calendar**, **Clients**, **Money**, **Settings**.

**Today:** sessions for today in order, with a status chip, payment status, the 4-hour reminder prompts (section 11), and a "needs attention" list (pending reviews, overpayments, unapplied payments, client reschedules).

**Calendar:**

- Week view on desktop, day view on mobile.
- Drag to move a session; snap 15 minutes; moves across days.
- Pull the bottom edge to extend; steps of 30 minutes between 60 and 180.
- A hatched buffer sits after each session. Moves that overlap another session plus its buffer, fall outside working hours, or land on a holiday are rejected with a plain-language message.
- Tap an empty slot to add a manual booking (search or create client, pick duration, mark fee paid or waived).
- Colours by status: confirmed, awaiting payment, needs review, own block, off day.
- Each session shows client display name and time. Tap for details (client, payment status, notes, mark attended or no-show, cancel).
- After she moves or cancels a session, prompt "Let client know?" with one-tap Email or SMS (same mechanism as reminders). Cancelling never creates a refund.
- Guest preview toggle showing exactly what the public sees.
- Recurring sessions: create a weekly series for a client with start date and optional end date. Occurrences materialise up to the booking horizon. A holiday or block clash is flagged for her to resolve and never auto-deleted.

**Clients:**

- List with search by display name, phone or ID. Each row: `C-0012`, display name, phone, verified badge.
- Client page: contact details (tap to call, WhatsApp, SMS), session and payment history, one short practical note (max 280 characters, labelled "Practical note only. No health information."), toggle "Verified client" with the private link, verified status and reschedule history, edit details, export (JSON and CSV), delete.
- Delete removes personal data and notes. Payment rows remain with the client replaced by "deleted client" so income history stays correct.

**Money:** log of every scheduling fee (date, client ID, provider, reference, amount, method auto or manual, flags). Income dashboard: totals by day, week and month, number of fees, a simple bar chart, Ethiopian month toggle, CSV export. Only scheduling fees are tracked; session fees are handled by her outside the app.

**Settings:** everything in section 6, including branding.

## 10. Privacy and security

- HTTPS only. Secure, HttpOnly, SameSite=Lax cookies. Sessions last 30 days on the phone. Origin checks on state-changing requests.
- Login: email and password, with forgot-password by emailed single-use link (expires in 30 minutes). Rate-limit login and reset.
- Rate limits on public endpoints (slot list, hold, submit proof). Limit active holds per phone and per IP. Cloudflare Turnstile on the hold step if `TURNSTILE_SECRET` is set. **[OPEN]**
- **No health information on the server.** The app stores no session notes, diagnoses or reasons for visit. The only free text is one short practical note per client (for example "prefers mornings") with a visible warning. The fact that someone is a client is itself sensitive, so keep access control, HTTPS and backups tight.
- Names, phones, emails are stored readable (needed for the app), protected by disk-level protection and access control.
- Screenshots are stored outside the web root, served only to the authenticated admin, and deleted 90 days after the booking is confirmed (setting). **[OPEN]**
- Validate all input (zod), parametrised SQL only, security headers (helmet), strict CSP.
- Neutral wording everywhere public: no "psychologist", "therapy" or "counselling" in the domain, email subjects, push text, or reminders. Use "appointment".
- Provide the verifier key only server-side.
- Nightly SQLite backup (`.backup`), encrypted, copied off the server, with a documented restore procedure.

## 11. Reminders and notifications

- A scheduler job runs every minute.
- **4 hours before each confirmed session**, send her a web push: "Appointment at 4:00 PM today. Remind client?" Tapping opens the session with two buttons:
  - **Send email:** the server sends a neutral reminder email to the client.
  - **Send SMS:** opens the iPhone Messages composer with a prefilled body via an `sms:` link. She presses send herself. Verify the exact `sms:` URL format works on iOS Safari and document it.
- Same prompts appear on the **Today** screen, so she is not dependent on push alone.
- iOS only delivers web push to a PWA installed to the Home Screen, and only after a user-initiated permission request. Build an onboarding step that walks her through Add to Home Screen and enabling notifications, and detects when it is not installed.
- **Morning summary:** at 07:00 Addis time (setting) send her a push, and optionally an email, listing today's sessions and anything needing attention. No evening email.
- Client-facing emails: booking confirmation (with `.ics`), reminder (manual trigger), session moved or cancelled (manual trigger), and reschedule confirmation (automatic, when a verified client changes a session). Plain, short, neutral.

## 12. Landing page

- Static, fast, one page: name and photo, a short plain bio, what to expect, location, FAQ, a clear "Book an appointment" button, the non-refundable fee note, and the terms link.
- All branding and text are editable in the admin Settings: practice name, logo upload, accent colour, photo, bio, FAQ, address and footer text. Ship hardcoded placeholder defaults (a simple psychology practice) used until she changes them. Public pages read these from the database (cached), so no code change or redeploy is needed.
- Calm, minimal design. Default theme: soft neutral background, deep green accent. Warn in the admin if a chosen accent colour has too little contrast for text.

## 13. API sketch

Public:

- `GET /api/slots?from&to&duration`
- `POST /api/holds`
- `POST /api/holds/:id/proof` (multipart: provider, reference, optional screenshot)
- `GET /api/holds/:id` (status polling)
- `GET /api/m/:token` (verified client: upcoming sessions and eligible slots) and `POST /api/m/:token/sessions/:id/reschedule`
- `GET /api/ics/:sessionId?t=signedtoken`

Admin (authenticated):

- `POST /auth/login`, `POST /auth/logout`, `POST /auth/forgot`, `POST /auth/reset`
- CRUD: `/api/admin/sessions`, `/clients`, `/series`, `/blocks`, `/holidays`, `/payment-accounts`, `/settings`
- `POST /api/admin/payments/:id/confirm` (manual confirm)
- `POST /api/admin/sessions/:id/notify` (channel email or sms-link data)
- `GET /api/admin/dashboard?range`
- `GET /api/admin/clients/:id/export`, `DELETE /api/admin/clients/:id`
- `POST /api/admin/push/subscribe`

## 14. Build phases

1. **Foundations:** repo, TypeScript, Docker, migrations, settings, admin login with forgot-password, tests running.
2. **Slot engine:** availability, buffer, holidays, blocks, holds with race-safe transactions. Heavy unit tests.
3. **Admin calendar:** FullCalendar with drag, resize, buffer rules, Ethiopian dates, manual booking, recurring series, guest preview.
4. **Public booking and payments:** booking pages, verifier client, partial-payment sums, replay protection, manual confirm, screenshots.
5. **Clients, verified clients and money:** client list and pages, short practical note, verified-client link and rescheduling rules, export and delete, income dashboard.
6. **Reminders and PWA:** push, Today screen, email and SMS-link prompts, install onboarding, offline shell.
7. **Landing page, polish, deployment:** content file, accessibility pass, backups, deployment guide.

## 15. Decisions and open items

Decided by the owner: all providers supported by the verifier (telebirr, cbe, cbebirr, dashen, abyssinia); 20 minute hold; no payment accepted after a hold expires (client starts again); no minimum notice; fee shown, not hourly rate; 90 minute sessions scale the fee; verified clients only reschedule (section 7b); no receipts; attendance tracking on; Latin month names; week starts Monday; offline read-only view; nightly encrypted backups; editable branding; no clinical data on the server; 4-hour reminder plus morning summary.

| #   | Still open                                                           | Default in use                       |
| --- | -------------------------------------------------------------------- | ------------------------------------ |
| 1   | Money paid after a hold expired                                      | Recorded as unapplied, she decides   |
| 2   | Verified client reschedule applies immediately or needs her approval | Immediately, she is notified         |
| 3   | Late-booking notice wording and threshold                            | Within 3 hours, prominent notice     |
| 4   | Show full address before payment or only after confirmation          | After confirmation; area only before |
| 5   | Client email verification                                            | None                                 |
| 6   | Morning summary time                                                 | 07:00                                |
| 7   | Anti-abuse on holds                                                  | Rate limits and optional Turnstile   |
| 8   | Receipt screenshot retention                                         | 90 days                              |

## 16. Acceptance criteria

- Two people cannot confirm the same slot, even when submitting simultaneously.
- A reference number cannot be used twice.
- A partial payment keeps the slot held and tells the client the exact remaining amount; a second payment completes it.
- A paid booking is never lost: expired-hold and verifier-down cases land in her needs-attention list.
- The guest view and the public API reveal nothing about other clients.
- Moving a session onto a clash, outside hours, or onto a holiday is blocked with a clear message.
- The 4-hour prompt appears as a push notification (when installed) and on the Today screen, and the SMS button opens a prefilled message in Messages.
- No health information is collected or stored anywhere.
- A verified client can reschedule one occurrence to a free slot within 4 weeks only if it is more than 7 days away, and cannot cancel without choosing a new time.
- A payment verified after a hold expired never confirms a booking and never disappears; it appears as an unapplied payment.
- Exports contain all of a client's data; deletion removes personal data but keeps income totals correct.
- The booking page loads in under 3 seconds on a throttled slow-3G profile.
