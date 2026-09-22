---
name: document-backend
description: Generates or refreshes docs/backend/*.md — one reference doc per NestJS module in backend/src (endpoints, business rules, validation, tests) plus the shared docs/backend/README.md index. Use this whenever the user asks to document the backend, write/update backend module docs, explain what a backend module does in writing, or after adding/changing a module, controller, service, or DTO under backend/src and they want the docs kept current. Also use it proactively if you notice docs/backend/ is stale relative to backend/src (a module exists in code with no matching .md, or a documented endpoint no longer matches the controller) — don't wait to be asked.
---

# document-backend

Produces the per-module reference docs under `docs/backend/` by reading the
actual NestJS source in `backend/src` — never from memory, never from the
plan/spec docs (those describe intent; this skill describes what the code
does *right now*, and the two can drift). Re-run this any time modules
change instead of hand-editing `docs/backend/*.md` — hand edits get
overwritten the next time someone forgets they exist and reruns this.

## Why this exists

Writing these docs well means reading controller + service + every DTO +
the touched entity fields for each module, cross-checking validation rules
against the actual `class-validator` decorators, and calling out the
non-obvious behavior (lock ordering, generated columns, snapshot semantics,
timezone handling) that isn't visible from signatures alone. Doing that by
hand each time is exactly the kind of repetitive, easy-to-shortcut work
that produces stale or shallow docs. This skill is the checklist that keeps
the depth consistent.

## When a "module" is documentable

A module is a directory under `backend/src/` containing a `*.module.ts`
file (e.g. `auth/`, `business/`, `product/`, `purchase/`, `sale/`,
`reports/`). `entities/`, `migrations/`, `scripts/`, and `common/` are not
modules — they're cross-cutting and belong in the README's "convenciones
transversales" section instead of getting their own file, unless one of
them grows enough behavior of its own to warrant it (use judgment — a
`common/` that's still just a pagination DTO doesn't need a page; a
`common/` that's grown a shared exception filter and three interceptors
does).

## Process

1. **List modules.** `find backend/src -maxdepth 1 -type d` (or Glob for
   `backend/src/*/*.module.ts`), excluding the non-module dirs above.
   Diff against the `.md` files already in `docs/backend/` — new module
   directory with no matching doc, or a doc with no matching module
   directory (module was removed/renamed) — both are signals, not just
   "generate everything from scratch every time."

2. **Per module, read (don't skip any of these):**
   - The controller — every route, its HTTP method, its guard/auth
     decorators (or lack of them — note whether it relies on a global
     guard), what it passes to the service.
   - The service — the actual logic: what it validates before writing,
     what it computes, what transactions/locks it opens and in what order,
     what it returns, every place it throws and under what condition.
   - Every DTO the module's endpoints accept (create/update/list-query) —
     read the real decorators, don't infer them from the field name. A
     field named `quantity` with only `@IsNumberString()` does **not**
     reject zero or negatives — say so explicitly if the DB constraint is
     stricter than the DTO (that gap is exactly the kind of thing worth
     documenting).
   - The entity fields the service actually touches — especially any
     `generatedType: 'STORED'` / `insert: false, update: false` columns,
     since "the app never assigns this, Postgres computes it" is a rule
     worth stating plainly.
   - The module's `*.spec.ts` and the matching `backend/test/*.e2e-spec.ts`
     — one sentence on what's actually covered, not a restatement of the
     file list.

3. **Write `docs/backend/<module>.md`** using the template below. Match the
   register of the existing docs in that folder (terse, technical, Spanish,
   no marketing language) rather than introducing a new voice module by
   module.

4. **Update `docs/backend/README.md`**: the module table (add/remove rows
   to match reality) and the "Gaps conocidos" section if this pass revealed
   a new one or resolved an old one. Don't touch "Convenciones
   transversales" unless the cross-cutting behavior itself changed (e.g. a
   new global guard, a new global pipe) — that section is deliberately
   shared, not per-module.

5. **Report back concisely**: which files were created, which were
   updated and why (new endpoint, changed validation, newly-noticed gap),
   and which modules had no changes since the docs were already accurate.
   Don't rewrite a file that would come out byte-identical.

## Template for `docs/backend/<module>.md`

```markdown
# <module-name>

<One or two sentences: what this module is for, in domain terms — not
"handles CRUD for X" but what the CRUD is actually accomplishing.>

**Archivos:** <controller>, <service>, <module>, <every dto file>.

## Endpoints

<Table: Método | Ruta | Auth (nota si es pública o hereda el guard global) |
Query/Body | Respuesta. One row per route, in controller declaration order.>

## Comportamiento

<The actual logic, in the order it executes for the interesting endpoints
(usually create/update, sometimes delete). Call out: transactions and lock
order explicitly; anything computed via decimal.js vs left to Postgres
generated columns; every explicit throw and its HTTP status; anything a
reader would get wrong by guessing from the method name alone.>

## Validación (`<DtoName>`)

<Table: Campo | Reglas — read straight from the decorators. If a DB
constraint is stricter than the DTO validation, say so here, not just in
"Comportamiento" — this is where someone checking "can I send X" will look
first.>

## Tests

<One sentence per spec file: what it actually exercises, not a restatement
of "has tests for create/update/delete." Name the interesting edge case if
there is one (a boundary condition, a concurrency scenario, a snapshot
check) rather than the routine ones.>
```

Omit a section only if it's genuinely empty for that module (e.g. a module
with no DTOs at all) — don't pad with "N/A", just leave the heading out.

## Template for the `docs/backend/README.md` index

Keep this stable — it's mostly the module table and the two cross-cutting
sections (Convenciones transversales, Gaps conocidos). Regenerating it from
scratch each time is fine as long as the cross-cutting sections don't lose
content that's still true; diff mentally against the previous version
before overwriting rather than starting from a blank page.

## Things this skill has caught before (why the "read, don't infer" rule matters)

- A DTO using `@IsNumberString()` on `quantity`/`unitCost` reads like it
  validates a positive number. It doesn't — it only checks the string is
  numeric. The real floor is a Postgres `CHECK` constraint, which means an
  invalid request fails with a raw `500`, not a clean `400`. Worth a line
  in both Comportamiento and Validación, in both `purchase` and `sale`.
- `update()` methods that do `Object.assign(entity, dto)` are only safe
  because the current DTO is narrow. That's a fact about *today's* DTO
  shape, not a guarantee — restate it fresh each pass rather than copying
  the old doc's wording forward, in case the DTO grew a field since.
- A controller with no `@UseGuards(...)` isn't necessarily unprotected —
  check for a global `APP_GUARD` registration in the owning module (or
  `app.module.ts`) before concluding a route is open. Getting this wrong
  in either direction (marking a protected route as public, or vice versa)
  is the single most misleading thing this doc could say.
