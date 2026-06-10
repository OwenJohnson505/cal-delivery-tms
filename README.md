# Cal Delivery TMS — Delivery Booking Wizard

A **design reference** implementation of the Cal Delivery booking screen, built as
React + TypeScript + Vite. It reproduces the behaviour and visual design of the
`booking-form-modern.html` prototype as a maintainable, typed, API-backed app — so a
developer can curate it into the production system.

> **Scope:** this project makes **no real external calls**. Every API/webhook is mimicked
> with dummy data that behaves like the real thing. It is structured so the developer
> drops in real endpoints/webhooks without touching the UI (see *Going live* below).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest (pure logic + mock API + store)
npm run typecheck  # tsc -b
npm run build      # production build
```

The app opens on the prototype's seed booking (two stops) so every flow is clickable.

## Architecture

```
src/
  app/        shell — rails, header, footer, icons, modal host
  features/   one folder per subsystem (route, address, goods/allocation in route,
              service, driver, cx, audit, documents, customer)
  lib/        PURE business logic ported verbatim from the prototype, fully tested.
              parseGoods, allocation, buildCxNotes, time, etaToClock, internalRank,
              requirements, postcode. No React, no business rule lives anywhere else.
  api/        typed client interfaces (one per integration seam) + a working mock
              built from the prototype's dummy data. createApi() is the swap point.
  store/      typed Zustand store (Immer) mirroring the prototype globals 1:1,
              plus a UI store and derived selectors that compose lib/.
  types/      the domain model (Stop, Address, TimeSpec, Pod, …)
  styles/     prototype.css — the prototype's stylesheet, ported verbatim (design tokens)
reference/    the prototype + spec + handover (the behavioural source of truth)
```

**Data flow:** components read the typed store and call `lib/` for any rule
(allocation gating, CX generation, requirements rollup). Server-ish data comes from
`useApi()`. No business rule lives in a component (it's all in tested `lib/`).

## Going live (the developer's job)

The UI only ever depends on the `Api` interface (`src/api/index.ts`) via `useApi()`.
To connect real services, you do **not** change the UI:

1. Implement the interfaces in `src/api/*.ts` (address providers, customers, driver feed,
   CX post, ops webhooks, documents, audit, persistence) against your real services.
2. Pass your implementation in:

   ```ts
   // src/main.tsx
   <ApiProvider api={createApi({ impl: myRealApi })}> … </ApiProvider>
   ```

   or fill the endpoint URLs in `src/api/config.ts` (`ApiEndpoints`) and back the mock
   methods with `fetch`.

Each mock method carries a `// Real impl:` note saying exactly what to call (e.g. *"POST
buildCxNotes() output to the CX API"*, *"run incoming ETAs through lib/etaToClock"*).
The §5 seam table in `reference/booking-form-developer-spec.md` is the full map.

## Guardrails honoured

- The four output formats (CX notes, goods "reads as", requirements rollup, delivery
  notes) come from `lib/` and match the prototype. `buildCxNotes` has a **golden snapshot
  test**.
- The known **EQ casing bug** (spec §5.3) is fixed in `lib/` (`eqHas` reads
  case-insensitively) with regression tests — product equipment such as *Straps* now
  rolls up.
- Allocation has a durable-identity type (`UnitIdentity`) ready for when allocation is
  persisted (spec §4.3 edge note); the current port matches the prototype's `idx` model.
```
