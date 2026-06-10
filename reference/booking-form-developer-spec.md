# Booking Screen — Developer Specification

**Component:** Delivery Booking screen (TMS)
**Reference build:** `booking-form-modern.html` (single-file HTML/CSS/JS prototype, no framework, no build step)
**Purpose:** This document explains how the prototype behaves so the production app can be built to match. The prototype is a **functional reference**, not production code — all data sources are in-memory stubs that must be replaced with API calls (see §10). The interaction logic, data shapes, and output formats, however, are intended to be implemented as-is.

---

## 1. Architecture overview

The screen is a single in-memory model rendered by plain functions. There is no virtual DOM; each subsystem owns a `render*()` function that rewrites a container's `innerHTML` from state. State mutates, then the relevant `render*()` is called.

```
State (plain JS objects)              Render functions
─────────────────────────            ─────────────────────────
stops[]            ───────────────►  renderAll()      → #stopsList (route cards or editor)
BOOK (customer)    ───────────────►  renderHeader()   → #ccBox
allocatedDriver    ───────────────►  renderDriver()   → #driverBox
MS / TAR / EQ      ───────────────►  renderReqs()     → #reqBox
cxNotes/flags      ───────────────►  renderProviders()→ provider drawer
DOCS / AUDIT       ───────────────►  modals (openDocs / openAudit)
```

Key global render entry point: **`renderAll()`** — re-renders the route list (or the full-screen stop editor when `editMode` is true), then calls `syncAssign()`, `renderReqs()`, and `refreshCX()` so derived views stay consistent after any change.

Layout shell:
- Fixed left rail (`.siderail-left`) = app navigation (icons only, representative).
- Fixed right rail (`.siderail`) = contextual drawers (History, Providers).
- `.app` reserves both rails via `padding-left`/`padding-right`.
- `.work` = header bar + `.main` (`.left` route/notes column + `.rail` commercial column) + footer.

---

## 2. Core data models

### 2.1 Stop object

A booking is an ordered array `stops[]`. **Route order is significant** (it gates goods allocation — see §4.3).

```js
{
  id:        Number,        // stable per-booking id; new = max(ids)+1
  type:      'Collection' | 'Delivery' | 'Both',
  q:         String,        // raw text currently in the address-find search box
  addr: {
    co:      String,        // company / premises name
    address: String,        // street line
    city:    String,
    pc:      String,        // postcode
    country: String,        // England | Scotland | Wales | N. Ireland
    src:     String,        // provenance label, e.g. 'Saved · internal', 'Google Places', 'Postcode lookup', 'Entered manually'
    cls:     String         // provenance class: 'internal' | 'places' | 'postcode'
  },
  contact:   { name, tel, email } | null,
  time:      TimeObject,    // see 2.2
  reference: String,        // customer/consignment ref for this stop
  note:      String,        // free-text instruction for this stop (shown to driver / on CX)
  goods:     String,        // free-text goods description (Collection/Both only) — see §4
  goodsTouched:  Boolean,
  alloc:     Array,         // legacy; live allocation is the ASSIGN map (§4.3)
  allocTouched:  Boolean,
  svc:       { twoman?:true, wait?:true },   // stop-scoped service flags (§5)
  status:    'booked' | 'enroute' | 'arrived' | 'collected' | 'delivered',
  eta:       String,        // 'HH:MM' absolute clock time (§7)
  pod:       PodObject | null,               // §6
  isReturn?: true           // set on an auto-generated wait-&-return leg (§5.3)
}
```

### 2.2 Time object

Times are stored as **`dd-mm-yyyy HH:MM` strings**. `parseDt()` parses them; `dtParts()` returns display parts.

```js
{ mode: 'asap' | 'at' | 'between' | 'by',
  at:   'dd-mm-yyyy HH:MM',   // mode 'at'
  by:   'dd-mm-yyyy HH:MM',   // mode 'by'
  from: 'dd-mm-yyyy HH:MM',   // mode 'between'
  to:   'dd-mm-yyyy HH:MM' }  // mode 'between'
```

- **ASAP** is a relative promise: rendered as *now + 45 minutes* at display time (it is not frozen). On a delivery it reads as "DIRECT" on CX (§8).
- **At / By / Between** carry explicit timestamps chosen via the calendar picker (`openDt` → `#dtpick`).

### 2.3 Customer / contact (`BOOK`)

The header binds to a separate customer/contact model (decoupled from stop site-contacts):

```js
BOOK = { cust: customerId|null, contact:{name,email,tel}|null, cIdx, editCC, adding, expanded, newC }
CUSTOMERS[]  // accounts
CONTACTS[]   // { name, email, tel, cust:customerId }  — many contacts per account
```
Search (`ccInput`) matches across contact name/email and company name, supports multi-account results, an "add new contact under this account" flow, and a domain-suggestion heuristic (`name@brightway.co.uk` → "create under Brightway?").

---

## 3. Address find (type-ahead lookup)

This is the most important interaction. The goal is **near-zero external API cost**: serve the internal database for free on every keystroke, and only hit paid providers (Google Places, postcode lookup) on explicit user intent.

### 3.1 Three tiers

| Tier | Trigger | Cost | Source (prototype stub) | Production source |
|------|---------|------|--------------------------|-------------------|
| **Internal DB** | every keystroke (≥2 chars) | free | `SAVED[]` | your DB: customer's saved + frequently-used addresses |
| **Google Places** | debounced after 3+ chars, and on explicit **Search** button | billed | `GOOGLE_PREDICT[]` | Places **Autocomplete** API |
| **Postcode lookup** | full postcode typed (offered as an action row), and on explicit **Postcode** button | billed | `POSTCODES{}` | postcode→address provider (Loqate / getAddress.io / PAF) |

### 3.2 Matching & ranking

```js
clean(s)        // → lowercase, strip non-alphanumeric, trim
fuzzy(hay, q)   // → true if q is a substring of hay OR any word in hay starts with q
isFullPostcode  // PC_RE = /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/
pcKey(s)        // → uppercased, spaces removed (POSTCODES key)
```

**Internal ranking** — `internalRank(q)`:
```js
SAVED.filter(a => fuzzy(a.co+' '+a.addr+' '+a.city+' '+a.pc, q))
     .sort((x,y) => (y.count||0) - (x.count||0))   // most-used first
     .slice(0,5);
```
`count` is the usage frequency. **In production this is the self-learning signal:** increment a per-customer (address) usage counter every time an address is selected/booked, and rank by it. The "★ 14×" tag in the UI is this count.

**Google predictions** — `googlePredict(q)` filters `GOOGLE_PREDICT` by `fuzzy(main+' '+sec)`, max 6. In production, replace with a Places Autocomplete request (debounced; reuse a **session token** across keystrokes so you're billed once per session, not per keystroke).

### 3.3 Render flow — `acInput(input)`

On input in a stop's address box:
1. Persist raw text to `stop.q`.
2. Bail if `< 2 chars` and not a full postcode.
3. Render **internal hits** first (section "This customer's frequent & saved").
4. If the query is a full postcode, render an **action row**: "List all addresses at `<PC>`" tagged *uses API* (calls `doPostcode`).
5. Reserve an `.ac-ext` container, then **debounce 300 ms** and call `renderGoogle(ext, q)` (the only place keystroke-driven external lookups happen).

`renderGoogle` paints a "Suggestions · Google Places" section with a footer reminder: *predictions billed per session, details charged only on select.*

### 3.4 Explicit buttons
- **Search** → `forcePlaces` → `doPlaces` (simulated ~400 ms latency, then predictions).
- **Postcode** → `forcePostcode` → `doPostcode` (validates `isFullPostcode`, simulated ~450 ms, lists `POSTCODES[pcKey(q)]`).

### 3.5 Selection — how an address is chosen

All selections funnel through `applyPick(el, src, cls)`, which reads `data-*` attributes off the chosen row, writes them to `stop.addr` (stamping `src`/`cls` provenance), sets `stop.q`, and re-renders.

```js
pickInternal → applyPick(el, 'Saved · internal', 'internal')   // immediate, no cost
pickPostcode → applyPick(el, 'Postcode lookup',  'postcode')   // immediate (lookup already paid)
pickPred     → // models Google Place Details:
               // shows "Fetching place details…", waits, then sets addr with src 'Google Places'
```

**Critical billing model for production:** Autocomplete predictions return a `place_id` only. The full structured address (street/city/postcode) is fetched with a **Place Details** call, which is the billed step. So:
- Render predictions cheaply (Autocomplete, session-tokened).
- Only on the user **selecting** a prediction do you call Place Details (one charge), then map the response into `stop.addr`. `pickPred`'s artificial delay represents exactly this round-trip.

`dataAttrs(a)` is the contract between a result row and the picker: `data-co / data-ad / data-city / data-pc / data-country`. Whatever provider you use, normalise its response into those five fields.

### 3.6 Stub data shapes
```js
SAVED          = [{ co, addr, city, pc, country, count }]
GOOGLE_PREDICT = [{ main, sec, co, addr, city, pc, country }]   // main/sec = the two-line prediction label
POSTCODES      = { 'WA27NE': [{ co, addr, city, pc, country }, …] }
```

---

## 4. Products (goods) — format, parsing & allocation

### 4.1 Input format

Goods live as **free text on collection (or Both) stops** (`stop.goods`), so an operator can paste straight from a customer email. Example: `2 pallets at 400kg total, 1 box`.

### 4.2 Parser — `parseGoods(text)`

Returns an array of line items. Algorithm:
1. **Split** on `, ; / +`, newlines, the word `and`, and `&`.
2. For each segment:
   - **Unit:** first match of `\b<unit>(s|es)?\b` against the `UNITS` vocabulary (`pallet, box, crate, carton, cage, drum, roll, bag, parcel, tote, stillage, barrel, sack, bundle, skid, container, item`).
   - **Weight:** `(\d+(.\d+)?)\s*(kg|kgs|kilo…|t|tonne…|lb…|g)` → normalised by `normWU()`; qualifiers `total|combined|altogether` and `each|per|apiece` are captured.
   - **Dimensions:** `N x N x N (mm|cm|m)`.
   - **Quantity:** a leading integer, or a number-word (`NUMWORDS`: one…ten, a, an); defaults to 1.
3. Item shape: `{ qty, unit (Capitalised), wt, dim, raw }`. Segments with no recognised unit become `{ qty:null, unit:null, raw }` (preserved verbatim).

Helpers: `plur(word)` (adds `es` after s/x/z/ch/sh, else `s`), `fmtItem(it)` (the "Reads as" preview), `itemShort(it)` (compact summary).

### 4.3 Per-unit model & allocation (multi-drop)

To split a consignment across drops, items are exploded into **individual units** with stable global indices:

`goodsUnits()` walks every collection's parsed goods and emits one entry per physical unit:
```js
{ idx, collId, unitName, label /* e.g. "Pallet 1 of 2" */, wt, dim }
```
A `qty:3` pallet line becomes three unit entries. `idx` is a stable, incrementing global index — **it is the allocation key.**

**Ownership** is the `ASSIGN` map: `ASSIGN[unitIdx] = deliveryStopId`. Each unit is owned by exactly one delivery (exclusive). UI: tick a unit on a delivery to move it there (`toggleUnit`), or "assign all available" (`assignAll`).

**Route-order availability** — `availableUnitsFor(stop)`:
```js
goodsUnits().filter(u => stopIndex(u.collId) < stopIndex(stop.id));
```
A delivery can only be given units **collected earlier in the route**. So with `Collect A → Deliver → Collect B → Deliver`, the second delivery sees units from both A and B; the first sees only A.

`syncAssign()` auto-assigns everything to the sole delivery when there's exactly one and the operator hasn't manually intervened (`assignTouched`). `deliverItems(stop)` groups the units owned by a stop back into counts for display/CX.

**Both** stops collect (their own `goods`) and deliver (their assigned units). **Wait & return** auto-creates a return-leg delivery (§5.3).

> Edge note for production: `goodsUnits()` is recomputed from text on every render, so `idx` is stable only while the goods text and stop order are unchanged. Persist allocation against a durable unit identity (e.g. `collId + lineIndex + occurrence`) rather than the transient `idx` if goods can be edited after allocation.

---

## 5. Requirements — the scope model

Requirements roll up from **three scopes**. This separation matters because it determines where each flag is stored and how it is priced/communicated.

| Scope | Meaning | Stored in | Items |
|-------|---------|-----------|-------|
| **Job / vehicle** | applies to the whole job & vehicle | `MS.equip.sel`, `MS.service.sel` | Tail lift, Pump truck (equipment); Dedicated, ADR (service) |
| **Stop** | applies at specific stop(s) | `stop.svc.{twoman,wait}` | Two-man, Wait & return (`STOP_SVC`; `svcKey()` maps label→flag) |
| **Product** | applies to an individual item | `EQ['<stopId>:<itemIndex>']` | Straps, Blanket (`PRODUCT_EQUIP`) |

`renderReqs()` builds `[label, scope]` rows: job items → "whole job"; stop items → "all stops" or "Stop N"; product items → the item summary. The right-hand panel renders these in two columns.

### 5.1 Two-man "Set for all stops"
`setAllTwoman(on)` sets `svcDefault.twoman` and applies `svc.twoman=true` to every stop. New stops inherit `svcDefault.twoman`.

### 5.2 Wait & return
Offered only on the **last** stop and only when it's a **Both** stop. Ticking it spawns a return-leg delivery (`isReturn:true`) whose address mirrors the original collection.

### 5.3 Known issue to fix in production
`EQ` stores **lowercase** flags (`{straps:true}`) but `renderReqs`/`buildCXNotes` test the **capitalised** `PRODUCT_EQUIP` keys (`e['Straps']`). As written, product-level equipment never rolls up. **Normalise the key casing** (store and read the same case) when porting.

---

## 6. Proof of delivery / collection (POD / POB)

```js
pod = {
  type:   'POD' | 'POB',           // delivery vs collection proof
  via:    'Manual' | 'CX API',     // how it was captured — drives the source tag
  by:     String,                  // user / system that added it
  at:     'dd-mm-yyyy HH:MM',
  name:   String,                  // signatory
  sig:    Boolean,                 // signature captured
  photos: Number                   // count of attached images
}
```
Inline on each stop card: a status chip (`statusChip`), an ETA badge when `status==='enroute'` (`etaBadge`), and a **View POD/POB** button when `pod` exists (`openPod` → `podHtml`). The audit trail (§9) also links to the same viewer (`openAuditPod`). The "Manual vs CX API" distinction is first-class — surface it everywhere a proof is shown.

---

## 7. Status & ETA

`status` ∈ `booked | enroute | arrived | collected | delivered`. **ETA is stored as an absolute clock time, never a countdown.** `etaToClock(v)`:
- `HH:MM` → kept as-is;
- a number / "15 mins" → `now + N minutes`, formatted `HH:MM`;
- applied on allocate (manual and from a driver estimate like "12 min").

So a "15 minute" estimate is frozen to e.g. `17:55`; revisiting the page later still shows `17:55` until the driver app pushes an update.

---

## 8. Courier Exchange (CX) posting notes

CX notes are auto-generated from the booking and stay **live until posted**, then freeze.

### 8.1 Lifecycle
```js
cxNotes   // current text (string)
cxDirty   // true once the operator hand-edits the textarea
cxPosted  // true after Post to CX

refreshCX()  // called from renderAll: regenerates cxNotes from the booking
             // UNLESS cxDirty or cxPosted (never clobber edits or a posted job)
rebuildCX()  // "Rebuild from booking" button: force regenerate, clears cxDirty
postCX()     // sets cxPosted = true (freezes), shows confirmation
```

### 8.2 Generator — `buildCXNotes()`

Output is a driver-readable, sectioned block. Structure:

```
COLLECTION //
<OUTCODE> -- <collTime> -- COLLECTING <items>      [-- (NOTE …)]

STOPS (n) //
DELIVERY / <OUTCODE>
<delTime> -- DELIVERING <items>
(NOTE IN BRACKETS, UPPERCASE)

COLLECTION / <OUTCODE>            ← a mid-route collection
<collTime> -- <items>

COLLECT & DELIVER / <OUTCODE>     ← a Both stop
<delTime> -- DELIVERING x, COLLECTING y

VEHICLE -- <TARIFF> -- <BODY TYPES> //
SERVICE -- DEDICATED DELIVERY -- ADR - CERTIFIED DRIVER -- TWO MAN (STOP 2) //
EQUIPMENT -- TAIL LIFT -- PUMP TRUCK -- STRAPS & BLANKETS //

STANDARD -- NO CO-LOADING -- HI VIS & SAFETY BOOTS -- UPLOAD & RETAIN SIGNED CUSTOMER PAPERWORK -- ONLINE QUOTES ONLY //
```

Rules:
- The **first collection** is the top `COLLECTION` block; every other stop is listed under `STOPS (n)` with an explicit action label (`DELIVERY` / `COLLECTION` / `COLLECT & DELIVER`).
- **Separators:** ` -- ` within a line; ` //` terminates section headers and the VEHICLE/SERVICE/EQUIPMENT/STANDARD lines. Per-stop notes are bracketed and uppercased.
- `outcode(pc)` = first half of the postcode (e.g. `WA2`). Drivers navigate by outcode at this stage.
- **Times:** `dstamp()` = `DAY DD/MM`; `tphrase()` adds the clock time (`TUESDAY 09/06, 10:30`, windows `…, 18:54-19:39`, `BY …`). `collTime` → `ASAP` when asap; `delTime` → `DIRECT` when asap.
- **Items:** `collectItems`/`deliverItems` produce uppercase, pluralised counts (`2 PALLETS, 1 BOX`).
- **Service line** merges job-scope service (Dedicated→"DEDICATED DELIVERY", ADR→"ADR - CERTIFIED DRIVER") with the stop-scope two-man rollup ("TWO MAN" or "TWO MAN (STOP 2)").
- **Equipment line** merges job equipment (Tail lift, Pump truck) with product equipment (Straps/Blanket → "STRAPS & BLANKETS").
- The **STANDARD** line is always appended — these are the operator's house defaults for every CX posting.

Everything is uppercased for CX house style; free-text notes are uppercased too.

---

## 9. Supporting subsystems (brief)

- **Docket audit** (`openAudit`): timeline from `AUDIT[]` — created/quoted, booked, posted to CX, driver allocated, POD/POB added — each with user, timestamp, Manual/CX-API tag, and a "View proof" link. Sorted by time.
- **Documents** (`openDocs`): `DOCS[]` of `{name, scope:'global'|stopId, by, at}`. Upload via a file input (`addDoc` reads the chosen filename); the **Docs** toolbar button shows a count badge. Per-stop vs global is the `scope` field.
- **Customer info pack** (`custInfo`): opening/closing hours, goods-in window, out-of-hours contact, site notes (from `CUSTINFO`). Opened from the info button on the customer line.
- **Route map** (`routeMap`): builds a Google Maps directions URL (`origin` = first stop, `destination` = last, middle stops as `waypoints`) from stop addresses and opens it.
- **Delivery notes** (`deliveryNotes`): generates a print-ready HTML doc (one note per delivery: customer, collected-from, deliver-to, goods, signature lines) in a new window with a Print button.
- **Providers** (`renderProviders`): internal drivers (interested/available, `DRIVERS[]`) + CX bids (`CXBIDS[]`). The sidebar badge shows **unseen options**: `provBadgeCount = provTotal() − provSeen`; `markProvSeen()` (on open) clears it; a new bid raises it to 1. Allocating from here, or via the inline Driver search, feeds the same `allocatedDriver` card (carrying id/rate/ETA). The Providers rail icon turns green while a driver is allocated (`syncAllocState`).
- **Inline cell editing** (`cellEdit`): double-click (or pencil) a route-card cell to edit just that field in a popover; Goods shows a live "Reads as" parse preview; Time opens the same calendar picker.

---

## 10. Production integration checklist

Replace each in-memory stub with a real source; the **function contracts above stay the same**.

| Prototype stub | Replace with |
|----------------|--------------|
| `SAVED[]` + `internalRank` | DB query of the customer's saved/used addresses, ranked by a persisted usage `count`; increment `count` on selection |
| `GOOGLE_PREDICT[]` + `googlePredict` | Places **Autocomplete** (session-tokened, debounced); render predictions from `place_id` |
| `pickPred` delay | Places **Place Details** call on selection → map to `addr` (`co/address/city/pc/country`); this is the billed step |
| `POSTCODES{}` + `doPostcode` | Postcode→address provider keyed by `pcKey(pc)` |
| `CUSTOMERS / CONTACTS` | CRM/accounts service; keep the multi-account search + add-contact + domain-suggestion behaviour |
| `DRIVERS / CXBIDS` | Driver availability service + CX bid feed (poll/websocket); keep the unseen-badge logic |
| `buildCXNotes()` output | POST to the CX API as the posting body; keep `cxDirty`/`cxPosted` freeze semantics |
| `pod` / `status` / `eta` | Driver-app webhooks/API; ETA arrives as an absolute time or minutes (run through `etaToClock`) |
| `DOCS` upload | File storage service; persist `{name, scope, by, at, url}` |
| `AUDIT[]` | Server-side immutable event log; render read-only |
| Save as Draft/Quote/Booking | Persistence endpoints; `jobStatus` drives the contextual footer actions |

**Also fix:** the product-equipment key-casing mismatch (§5.3).

---

## 11. Running the reference build

It is a single self-contained file — **open `booking-form-modern.html` in any modern browser**, no server or build step. All interactions (address find, goods parsing, allocation, requirements, CX note generation, POD viewer, drawers, modals) are live against the stub data so the developer can click through every flow. View source to read the exact implementation of every function named in this document.
