---
target: public-app/src/LandingPage.tsx
total_score: 32
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:D:\\Apps\\2019\\mentalweg\\public-app\\src\\LandingPage.tsx"
target_fingerprint: "sha256:179c7be09e29293abdf5eece996603b7c8d41c3020c5a86ed91f0e4347a077a2"
target_path: "D:\\Apps\\2019\\mentalweg\\public-app\\src\\LandingPage.tsx"
timestamp: 2026-10-18T17-13-43Z
slug: public-app-src-landingpage-tsx
---
Method: dual-agent (A: 125172c1-7667-4721-8496-3d8fcf7da16b · B: 245b0d33-e7c3-4141-91a9-12de046c8343)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|:-----:|-----------|
| 1 | Visibility of System Status | 3 | Top scroll progress bar and floating stage rail provide clear orientation, but 700ms wheel throttle lacks visual feedback on rapid trackpad scrolls. |
| 2 | Match Between System and Real World | 4 | Exemplary cultural integration: dawn-based Ethiopian clock cycles (ጥዋት / ቀን / ማታ / ሌሊት), dual-calendar syncing, and local payment rails (Telebirr/CBE Birr). |
| 3 | User Control and Freedom | 2 | **Critical friction**: Desktop scroll-jacking via `handleWheel` and touch threshold intercepts native inertia and locks users into stepped 100vh transitions. |
| 4 | Consistency and Standards | 3 | CTA buttons use 5 different verb phrases across 5 stages (*"Book Now"*, *"Explore Ethos"*, *"Reserve with Dr. Hana"*, *"Select Consultation Time"*, *"Begin Your Appointment Booking"*). |
| 5 | Error Prevention | 3 | Solid Ethiopian phone number validation, but payment reference input lacks inline formatting cues for Telebirr transaction IDs. |
| 6 | Recognition Rather Than Recall | 4 | Session summary cards repeat chosen slot, date, both clock formats, and deposit amount throughout Step 2, Step 3, and Confirmation. |
| 7 | Flexibility and Efficiency of Use | 3 | Returning clients with a saved `time_pref` cookie are forced to re-select clock convention in Step 1 before picking slots. |
| 8 | Aesthetic and Minimalist Design | 4 | Exquisite restraint: organic sanctuary palette (eucalyptus spruce, terracotta, sand), uncluttered typography, and calm spatial breathing room. |
| 9 | Help Users Recognize, Diagnose, and Recover from Errors | 3 | Error alerts are descriptive, but rendered in a generic top-of-card box rather than inline adjacent to invalid inputs. |
| 10 | Help and Documentation | 3 | Clear clinic location and operating hours, but lacks a concise FAQ covering arrival privacy, first-session preparation, and cancellation rules. |
| **Total** | | **32/40** | **Good (80%)** |

---

## Design Specificity Verdict

**Verdict**: **8.5 / 10 — Culturally Authentic Sanctuary with Residual Scrollytelling Friction**

- **LLM Assessment**: Mental Weg demonstrates rare cultural authenticity. Rather than adopting generic Silicon Valley health SaaS conventions, it centers on the Amharic tradition of **"Weg" (ወግ)** — heart-to-heart, unhurried discourse free of social stigma. The dual Ethiopian/Gregorian time engine, local cash and Telebirr mechanics, and Bulgaria Corridor privacy safeguards are deeply rooted in Addis Ababa reality. However, desktop scroll-jacking (`handleWheel` locking transitions) and English-only stage copy distance the experience from an intimate sanctuary.
- **Deterministic Scan**:
  - `public-app/src/LandingPage.tsx:722`: `bounce-easing` (Advisory / Slop). Tailwind `animate-bounce` on the bottom navigation chevron conveys restlessness and jitter rather than serene stability.
  - No false positives detected.
- **Code & Structural Evidence**:
  - Missing `@media (prefers-reduced-motion: reduce)` across 3,668 lines of CSS, failing WCAG 2.3.3 for vestibular motion sensitivity during 75vh slide transitions.
  - `--subtle-text: #7f9189` on `#fbfaf8` yields **2.84:1** contrast ratio, failing WCAG AA (4.5:1).
  - Missing `:focus-visible` ring on `.stage-rail-node` and primary button tokens.
  - Modal overlay (`selectedPoster`) lacks ARIA dialog semantics (`role="dialog"`, `aria-modal="true"`) and `Escape` key listeners.

---

## Overall Impression

Mental Weg feels remarkably calming, authentic, and emotionally grounded. The visual identity of warm terracotta, eucalyptus spruce, and soft sand creates an instant sanctuary feeling. The single biggest opportunity to unlock exceptional craft is **liberating the page from desktop scroll-jacking**: replacing artificial wheel-interception with natural, butter-smooth native scroll-snap or unhurried document flow so users feel in complete control of their journey.

---

## What's Working

1. **Dual-Clock Cultural Architecture**: Seamlessly translating GMT+3 24h schedules into traditional Ethiopian 12-hour dawn cycles (starting at 6:00 AM) respects local patients with effortless clarity.
2. **Atmospheric Visual & Theme Restraint**: The light and dark mode execution is world-class. Deep nocturnal spruce (`#0d1512`) and emerald glows in dark mode, paired with warm clay and sand in light mode, evoke a physical therapy room in Entoto rather than a clinical hospital.
3. **Compassionate De-Stigmatization Architecture**: Explicitly assuring patients that the system *never records visit reasons or clinical diagnostic notes* directly dismantles the primary barrier to mental healthcare in Ethiopia.

---

## Priority Issues

### [P0] Remove or Relax Desktop Scroll-Jacking
- **What**: `handleWheel` in `LandingPage.tsx` intercepts all mousewheel scrolls, invokes `e.preventDefault()`, and enforces a 700ms locked transition between slides.
- **Why it matters**: Breaks native trackpad inertia, triggers disorientation or motion sickness for vulnerable patients, and traps users attempting internal scrolling.
- **Fix**: Transition to smooth native CSS scroll-snapping (`scroll-snap-type: y mandatory`) or unconstrained fluid scrolling with stage rail progress tracked via `IntersectionObserver`.
- **Suggested Command**: `/impeccable polish`

### [P1] Persistent Top-Bar Crisis Hotline (907) Access
- **What**: The **907 National Mental Health Crisis Hotline** is buried at the bottom of Stage 4.
- **Why it matters**: A visitor in acute crisis should never be forced to navigate past workshop posters or philosophy pillars to reach emergency support.
- **Fix**: Introduce a quiet, persistent crisis lifeline pill in the fixed header: *"In acute distress? Call 907 (Free 24/7)"* with a direct `tel:907` action.
- **Suggested Command**: `/impeccable clarify`

### [P2] Eliminate `animate-bounce` & Add `prefers-reduced-motion` Support
- **What**: `ChevronDown` uses Tailwind's jittery `animate-bounce` (`LandingPage.tsx:722`), and CSS has zero `prefers-reduced-motion` guards for 75vh slide transitions.
- **Why it matters**: Violates WCAG 2.3.3 and injects anxious, playful motion into a serious mental wellness environment.
- **Fix**: Replace bounce with a subtle opacity pulse using `var(--ease-out-expo)`, and wrap all large transforms in `@media (prefers-reduced-motion: reduce)`.
- **Suggested Command**: `/impeccable animate`

### [P3] Bypass Convention Picker for Returning Clients & Clarify Upfront Pricing
- **What**: Returning users with saved clock preferences are forced through Step 1 (Convention Picker) on every booking, while session fee (1,200 ETB) is hidden until Step 3.
- **Why it matters**: Adds unnecessary friction to the booking flow and creates pricing hesitation for first-time clients.
- **Fix**: Check stored convention cookie in `handleStartBooking` and advance straight to calendar slots in Step 2; display a transparent pricing chip in the Hero (*"ETB 1,200 / 60-min session · ETB 300 deposit"*).
- **Suggested Command**: `/impeccable optimize`

---

## Persona Red Flags

- **Jordan (Confused First-Timer Seeking Therapy)**:
  - *Pricing Hesitation*: Arrives at Hero, sees *"Book Now"*, but has no idea whether therapy costs 500 ETB or 10,000 ETB.
  - *Crisis Lag*: If experiencing an active panic attack, the national 907 hotline is completely out of reach 4 stages down.
- **Riley (Deliberate Stress Tester)**:
  - *Wheel Freezing*: Flicking a precision trackpad swallows delta events in the 700ms throttle, making the site feel frozen or broken.
  - *Escape Key Inaction*: Opening a workshop poster card modal and pressing `Esc` fails to dismiss the modal.
- **Casey (Distracted Mobile User)**:
  - *Touch Sensitivity*: The 55px vertical swipe threshold causes accidental stage skipping while reading text on a bumpy minibus ride.
  - *Lost Spatial Awareness*: The right-hand stage rail disappears completely below 900px, leaving no indicator of total page length.

---

## Minor Observations

- **Subtle Amharic Titles**: Adding Amharic script subtitles under stage headings (e.g., *“የግል ምክክር እና የስነ-ልቦና ህክምና”*) would deepen the local "Weg" cultural identity.
- **Focus Rings**: Add `:focus-visible` styling (`outline: 2px solid var(--emerald-600)`) to `.stage-rail-node` and action buttons for keyboard navigation.
- **Telebirr Reference Hints**: Provide placeholder or helper text demonstrating an example Telebirr transaction code format.

---

## Questions to Consider

1. *What if the sanctuary landing page was an unhurried, continuous room of stillness rather than a quantized presentation to scroll through?*
2. *How can Dr. Hana's voice be made more personal and welcoming during the calendar booking flow, turning an intake form into an empathetic conversation?*
3. *What comforting micro-experience can we provide during the waiting window after a client submits their Telebirr deposit slip?*
