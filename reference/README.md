# reference/

This folder holds the **behavioural source of truth** for the port.

## Expected files (NOT YET PROVIDED)

| File | What it is |
| --- | --- |
| `booking-form-modern.html` | The working prototype — runnable in a browser. The byte-for-byte reference for behaviour, the four output formats (CX notes, delivery-note print, goods "reads as" preview, requirements rollup), and visual design. |
| `booking-form-developer-spec.md` | The deep technical spec (data models, every subsystem, function names, API seams). |
| `CLAUDE-CODE-HANDOVER.md` | The handover / roadmap. |

## Status

As of scaffolding, **none of these three files were present on the machine** (searched
the project dir, Downloads, Repos, and OneDrive). The handover text was pasted into
chat, but the artifacts themselves were never on disk.

**Action required:** drop at least `booking-form-modern.html` into this folder. Until
then, the pure-logic modules in `src/lib/` are typed stubs that throw — they MUST be
ported from the prototype, not reconstructed from spec prose, because the spec and the
prototype are known to disagree in places (see the §6 gotchas in the handover, e.g. the
EQ casing bug and the allocation-index durability issue).

## Porting checklist (once the prototype is here)

1. Read the prototype + spec end-to-end.
2. Confirm/extend the types in `src/types/` against spec §2.
3. Port each `src/lib/` module with behaviour identical to the prototype; add unit tests.
4. Add a **snapshot test for `buildCxNotes`** using the prototype's current output as the golden file.
5. Fix-on-port: the EQ lowercase/capitalised casing bug, and persist allocation against a durable identity (collId + lineIndex + occurrence) instead of the render-time `idx`.
