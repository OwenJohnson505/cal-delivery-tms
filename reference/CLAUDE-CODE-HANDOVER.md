# Handover → Claude Code: Cal Delivery Booking Wizard

> **Read this first, then read `booking-form-developer-spec.md` (deep detail) and open `booking-form-modern.html` (the working prototype).** This file tells you where we are, how things are built, what's real vs faked, and exactly what to do next.

---

## 0. TL;DR

You're inheriting a **finished, interactive prototype of one screen** of a Transport Management System (TMS): the **Delivery Booking Wizard**. It's a single self-contained `booking-form-modern.html` (~146 KB, vanilla HTML/CSS/JS, no framework, no build). Every interaction works against in-memory stub data. The goal now is to **build this out into a real application** — start by treating the prototype as the source of truth for behaviour and visual design, then port it into a maintainable, API-backed **React + TypeScript** app (stack & structure in §7).

Three artifacts ship with this handover:
| File | What it is |
|------|------------|
| `booking-form-modern.html` | The working prototype — the behavioural & visual spec, runnable in a browser |
| `booking-form-developer-spec.md` | Deep technical spec: data models, every subsystem, function names, API seams |
| `CLAUDE-CODE-HANDOVER.md` | This file — orientation + roadmap for continuing the build |

---

## 1. What the prototype already does (scope that is "complete")

The booking wizard is feature-complete as a prototype:

- **Route as a vertical stop list** — Collection / Delivery / Both stops, each an expand/collapse card; full-screen per-stop editor with Prev/Next.
- **Smart address find** — internal frequent/saved DB (free, type-ahead, frequency-ranked) → Google Places predictions (debounced/on-demand) → full-postcode address lookup. Selection writes a normalised address.
- **Customer & contact** — account + contact search (by name/email/company), multi-account picker, add-new-contact flow, domain suggestion, info pack.
- **Goods** — free-text entry, a parser that extracts qty/unit/weight/dimensions, a live "reads as" preview, and a **per-unit allocation model** that splits a consignment across drops with route-order availability.
- **Service & vehicle** — tariff combobox, multi-select body type / equipment / service; a **requirements rollup** across job / stop / product scopes.
- **Driver** — inline search-and-allocate (name or ID), rate + ETA (stored as absolute clock time), copy-to-clipboard ID; a Providers drawer with internal drivers + CX bids and an unseen-count badge.
- **Courier Exchange notes** — auto-generated, driver-readable posting text that stays live until posted, then freezes.
- **Ops extras** — per-stop status / ETA / POD-POB viewer (Manual vs CX-API), Docket audit timeline, booking documents (global or per-stop), route map (Google Maps), printable delivery notes, contextual Draft/Quote/Booking footer, inline cell editing.
- **Shell** — left app-nav rail (icons), right contextual drawer rail, header, footer.

§1–§11 of the developer spec document each of these precisely.

---

## 2. How to run it

```bash
# no install, no server, no build:
open booking-form-modern.html        # macOS
# or just double-click it / drag into a browser
```
Everything is live against stub arrays defined inside the file. To read any function's real implementation, view source and search for the name (they're all referenced in the spec).

---

## 3. Architecture of the prototype (so you port it faithfully)

- **One in-memory model, plain render functions.** No virtual DOM. State is mutated, then a `render*()` function rewrites a container's `innerHTML`. Global entry point: `renderAll()`.
- **State lives in module-scope variables** inside the `<script>`: `stops[]`, `BOOK`, `MS`/`TAR`/`EQ`, `allocatedDriver`, `cxNotes`/`cxDirty`/`cxPosted`, `ASSIGN`, plus the stub datasets.
- **The route order of `stops[]` is meaningful** — it gates goods allocation (a delivery can only receive units collected earlier in the route).
- **Pure business logic is isolated in named functions** — `parseGoods`, `goodsUnits`, `availableUnitsFor`, `buildCXNotes`, `internalRank`, `googlePredict`, `etaToClock`, `renderReqs`. These are the crown jewels: port them with their behaviour identical and cover them with tests.

---

## 4. State model — quick reference

(Full detail in spec §2.) The central object is the stop:

```js
stop = {
  id, type:'Collection'|'Delivery'|'Both', q,
  addr:{co,address,city,pc,country,src,cls},
  contact:{name,tel,email}|null,
  time:{mode:'asap'|'at'|'between'|'by', at,by,from,to},   // 'dd-mm-yyyy HH:MM'
  reference, note, goods, goodsTouched, allocTouched,
  svc:{twoman?,wait?}, status, eta:'HH:MM', pod|null, isReturn?
}
```
Allocation is a separate map: `ASSIGN[globalUnitIdx] = deliveryStopId` (exclusive ownership). Requirements come from three scopes: job (`MS.equip`/`MS.service`), stop (`stop.svc`), product (`EQ['stopId:itemIndex']`).

---

## 5. What's real vs stubbed (the API seams)

Everything below is faked with in-memory data and `setTimeout` to mimic latency. **These are your integration points** — the function contracts stay, the data source changes (spec §10 has the full table):

| Stub | Becomes |
|------|---------|
| `SAVED[]` + `internalRank` | customer's saved/used addresses from your DB, ranked by a persisted usage `count` (increment on select) |
| `GOOGLE_PREDICT[]` | Places **Autocomplete** (session token, debounced) |
| `pickPred` delay | Places **Place Details** on select → map to `addr` (the billed call) |
| `POSTCODES{}` | postcode→address provider (Loqate / getAddress.io / PAF) |
| `CUSTOMERS`/`CONTACTS` | CRM/accounts service |
| `DRIVERS`/`CXBIDS` | driver availability + CX bid feed (poll/websocket) |
| `buildCXNotes()` output | POST body to the CX API (keep `cxDirty`/`cxPosted` freeze) |
| `pod`/`status`/`eta` | driver-app webhooks (run ETAs through `etaToClock`) |
| `DOCS` / `AUDIT` | file storage / server-side event log |
| Draft/Quote/Booking | persistence endpoints (`jobStatus` drives footer actions) |

---

## 6. Gotchas & things to fix on the way through

- **Single 146 KB file.** Splitting it into modules/components is an explicit early task, not optional.
- **Known bug:** `EQ` stores **lowercase** flags (`{straps:true}`) but the rollup/CX code reads **capitalised** keys (`e['Straps']`), so product-level equipment never appears. Normalise the casing when you port (spec §5.3).
- **Allocation index is transient.** `goodsUnits()` recomputes `idx` from text every render — stable only while goods text and stop order are unchanged. Persist allocation against a durable identity (`collId + lineIndex + occurrence`), not the render-time `idx`.
- **ASAP is relative** (now + 45 min, recomputed at display). **ETA is absolute** (frozen `HH:MM`). Don't conflate them.
- **CX note format is business-critical** (separators, uppercase, outcodes, the STANDARD defaults line). Port it character-for-character and snapshot-test it.

---

## 7. The stack (decided) & repo structure

Build it as **React + TypeScript + Vite**. TypeScript earns its keep immediately given the rich `stop`/`addr`/`time`/`pod` shapes. Concretely:

- **State:** a single typed **Zustand** store with actions — the prototype's module-scope variables map almost 1:1; use **Immer** for the nested `stops[]` / `ASSIGN` updates.
- **Data:** **TanStack Query** over a thin typed API client. Each stub in §5 becomes one client method behind an interface, so mock and real implementations are swappable.
- **Styling:** CSS Modules (or Tailwind if the team already uses it); port the prototype's CSS variables as design tokens.
- **Tests:** **Vitest** for the pure logic + snapshots; Playwright later for end-to-end flows.

Proposed repo structure:

```
src/
  app/        # shell: layout, left nav rail, right drawer rail, header, footer
  features/
    route/        # stop list + full-screen stop editor
    address/      # address-find (provider interface: internal | places | postcode)
    goods/        # parser + per-unit allocation UI
    service/      # tariff, body/equipment/service, requirements rollup
    driver/       # inline allocate + providers drawer (drivers, CX bids, badge)
    cx/           # posting-notes generator + drawer
    pod/          # status, ETA, POD/POB viewer
    audit/  documents/  customer/    # audit timeline, docs, customer info pack
  lib/        # PURE business logic, no React: parseGoods, allocation,
              #   buildCxNotes, etaToClock, internalRank, requirements rollup
  api/        # typed client + interfaces; mock impls built from the prototype stubs
  types/      # Stop, Address, TimeSpec, Pod, Requirement, Driver, Bid, ...
  store/      # zustand store + actions
reference/
  booking-form-modern.html   # the prototype, kept viewable as source of truth
```

`lib/` is the heart of the port — framework-free, fully tested, shared by both UI and API. Fix everything in §6 (the casing bug, the allocation-index durability) inside `lib/`.

**Migration strategy:**

1. **Lock the visual/behavioural baseline** — the prototype is the reference. Don't redesign while porting.
2. **Extract the pure logic first** (`parseGoods`, `goodsUnits`/allocation, `buildCXNotes`, `etaToClock`, `internalRank`, `requirements rollup`) into typed, unit-tested modules. These encode the business rules and must not drift.
3. **Define the types** for `Stop`, `Address`, `TimeSpec`, `Pod`, `Requirement`, `Driver`, `Bid`, etc. from spec §2.
4. **Rebuild the UI subsystem by subsystem**, in this order (lowest coupling → highest): Route/Stops → Address find → Goods & allocation → Service/Requirements → Driver/Providers → CX notes → POD/Status → Audit/Docs → header/footer shell.
5. **Stand up the API layer last**, swapping each stub for a real call behind the existing contract; keep the stubs as mock fixtures for tests/storybook.

---

## 8. Concrete first backlog (ordered)

1. Scaffold **React + TypeScript + Vite** (+ Zustand, TanStack Query, Vitest) using the §7 structure; commit the prototype to `reference/booking-form-modern.html` so it stays viewable.
2. Define shared TypeScript types from spec §2.
3. Port + unit-test the pure logic modules (§7 step 2). Add a snapshot test for `buildCXNotes` using the prototype's current output as the golden file.
4. Build the **Route/Stops** view (cards + full-screen editor) against typed state.
5. Build **Address find** with a provider interface (`internal | places | postcode`) so real APIs slot in; wire the session-token + Place-Details-on-select billing model.
6. Build **Goods + allocation**; fix the `idx` durability and the `EQ` casing bug here.
7. Build **Requirements**, **Driver/Providers**, **CX notes**, then the ops extras.
8. Replace stubs with API calls one seam at a time (§5).

---

## 9. Guardrails (definition of done for the port)

- Behaviour matches the prototype (same flows, same edge cases) — verify side-by-side.
- The four output formats are **byte-identical** to the prototype: CX notes, delivery-note print doc, goods "reads as" preview, requirements rollup.
- Pure logic has unit tests; CX notes and goods parsing have snapshot tests.
- No business rule lives only in a component — keep it in the tested modules.
- The known bug (§6) is fixed and covered by a test.

---

## 10. Suggested opening prompt to give Claude Code

> "This repo will become the Cal Delivery TMS, built with **React + TypeScript + Vite** (Zustand store, TanStack Query, Vitest). Read `CLAUDE-CODE-HANDOVER.md`, then `booking-form-developer-spec.md`, then open `reference/booking-form-modern.html`. Then scaffold the app using the repo structure in §7, define the TypeScript types from spec §2, and port the pure logic into `src/lib/` (`parseGoods`, allocation, `buildCxNotes`, `etaToClock`, `internalRank`, requirements rollup) with unit + snapshot tests before touching any UI. Treat the prototype as the behavioural source of truth and don't redesign while porting. Begin by proposing the repo structure and the type definitions for my review."

---

### File manifest
- `reference/booking-form-modern.html` — runnable prototype (put it here)
- `booking-form-developer-spec.md` / `.docx` — full technical spec
- `CLAUDE-CODE-HANDOVER.md` — this handover

### Glossary
**Stop** a collection/delivery/both point · **Outcode** first half of a UK postcode · **POB/POD** proof of collection/delivery · **CX** Courier Exchange (third-party haulage marketplace) · **Tariff** the rate card/vehicle profile · **Two-man / Wait & return / ADR / Tail lift** service & equipment requirements.
