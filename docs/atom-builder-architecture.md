# Atom Builder Architecture and Upgrade Plan

## Purpose

This document records the current TAL/Ascentra Atom Builder architecture and the implementation boundaries for a production-grade visual automation platform. The existing builder remains the source of truth for current user-facing behavior while new model, schema, canvas, persistence, and execution capabilities are introduced incrementally.

The upgrade does not introduce a second canvas library. The application will continue to use the custom React canvas already embedded in `src/AutomationAtomBuilder.jsx`, with reusable interaction logic extracted into focused modules.

## Current architecture

### Frontend shell

- `src/App.jsx` lazy-loads the platform and the dedicated `AtomBuilderPage`.
- `src/AtomBuilderPage.jsx` provides the fullscreen builder route wrapper, workspace identity, plan context, and navigation actions.
- `src/AutomationAtomBuilder.jsx` owns the current builder workspace, templates, canvas rendering, palette, inspector, graph editing, validation UI, run controls, management panels, and local interaction state.
- `src/responsive.css` provides the existing dark TAL/Ascentra visual system, responsive layout rules, builder canvas styling, and accessibility hooks.

### Workflow model and graph helpers

- `src/atom-builder/registry.js` contains palette categories, core atom definitions, visual metadata, supported native kinds, default native configuration, and agent-derived palette entries.
- `src/atom-builder/graph.js` contains cycle prevention, branch route labels, upstream reachability, and pre-run workflow validation.
- The current persisted model uses nodes with `id`, display metadata, `lane`, `column`, optional `x`/`y`, `config`, and `makeConfig`. Edges use `from`, `to`, and optional `label`.

### Backend adapter

- `src/lib/automationBackend.js` is the only frontend backend seam. It uses `supabase.functions.invoke` for legacy and native execution and Supabase tables for workflow CRUD, execution history, approvals, schedules, webhooks, variables, connections, and credentials.
- The native path sends a normalized graph to `create-execution`; the worker and shared engine own runtime execution.
- Browser code must never receive service-role keys, worker keys, or credential secrets.

### Native execution engine

- `supabase/functions/_shared/types.ts` defines the native graph and execution contracts.
- `supabase/functions/_shared/graph.ts` plans and validates the graph.
- `supabase/functions/_shared/expression.ts` evaluates supported expressions without JavaScript `eval`.
- `supabase/functions/_shared/atoms/registry.ts` defines executable atom kinds.
- `supabase/functions/create-execution/index.ts` snapshots a workflow for execution.
- `supabase/functions/tal-worker/index.ts` executes queued nodes, handles retries, approvals, branching, and execution state.
- `workflow_versions`, `executions`, and `execution_node_runs` are the intended native persistence primitives for version history and observability.

## Gaps addressed by the upgrade

1. Normalize workflow state behind typed model helpers without forcing a rewrite of the existing JSX shell.
2. Give each executable atom a versioned definition containing input/output port types, config fields, and validation rules.
3. Drive the inspector from node definitions while retaining existing custom controls and native configuration.
4. Add explicit transform mappings, typed upstream data suggestions, and safe expression validation.
5. Extract canvas geometry, selection, multi-select, keyboard commands, snapping, pan/zoom, and connection validation into reusable modules.
6. Add optimistic local draft state and version-aware save behavior with conflict detection.
7. Keep native execution as the only production execution path; simulation must be a clearly labeled, side-effect-free preview.
8. Preserve the existing platform routes, authentication, Supabase adapter, plan behavior, and TAL/Ascentra visual language.

## Target module boundaries

### `src/atom-builder/model.js`

Owns schema-shaped workflow defaults, immutable graph normalization, node/edge updates, topology helpers, and serialization compatibility with the existing adapter.

### `src/atom-builder/definitions.js`

Owns versioned node definitions, typed ports, configuration field descriptors, and default values. Registry palette items reference definitions rather than duplicating execution behavior.

### `src/atom-builder/validation.js`

Owns definition-driven node validation, port compatibility checks, duplicate/dangling connection checks, trigger/reachability checks, cycle detection, and user-facing issue metadata.

### `src/atom-builder/mapping.js`

Owns safe path access, data type inference, transform mapping, branch predicate normalization, and expression token validation. It must never evaluate arbitrary JavaScript.

### `src/atom-builder/canvas.js`

Owns pure geometry and interaction state: world/screen coordinate conversion, node bounds, edge anchors, snap points, visible-node filtering, selection sets, and command intents. React event binding remains in a thin component layer.

### `src/atom-builder/persistence.js`

Owns draft metadata, save status, optimistic snapshots, version identifiers, conflict payloads, and migration between the legacy flow shape and the native version shape.

### `src/atom-builder/simulation.js`

Owns a local, side-effect-free graph walk that evaluates supported transform and branch operations against a test payload. Unsupported external atoms are represented as explicit simulation boundaries rather than fake successful calls.

### `src/atom-builder/execution.js`

Owns normalization of execution requests, terminal status handling, node status aggregation, and the adapter boundary for native execution. Runtime execution remains in Deno edge functions.

## Typed graph contract

The frontend remains plain JSX/JavaScript, but data contracts are represented by JSDoc typedefs and runtime validators.

- `WorkflowNode`: `id`, `kind`, `type`, `title`, `position` (`x`/`y` or `lane`/`column`), `config`, `definitionVersion`, and metadata.
- `WorkflowEdge`: `id`, `sourceNodeId`, `sourcePortId`, `targetNodeId`, `targetPortId`, and optional `branchLabel`.
- `PortDefinition`: `id`, `label`, `dataType`, `required`, `multiple`, and `description`.
- `NodeDefinition`: `kind`, `version`, `inputs`, `outputs`, `configFields`, `defaults`, and `validate`.
- `WorkflowSnapshot`: graph plus flow metadata, version metadata, and serialization timestamp.

The adapter converts this contract to the existing database column names (`from_node_id`, `to_node_id`, `column_index`, and `make_config`) until the backend migration is ready.

## Phased implementation order

1. **Audit and documentation** — establish current behavior, seams, risks, and acceptance criteria.
2. **Workflow model** — add schema constants, normalization, immutable updates, and compatibility serialization.
3. **Definition registry** — add typed ports and config schemas for every currently functional atom.
4. **Validation and mapping** — add definition-driven validation, safe path mapping, and expression checks.
5. **Canvas interactions** — extract geometry, pan/zoom, snapping, selection, multi-select, keyboard commands, and edge creation.
6. **Inspector and ports** — render typed port labels and schema-driven fields while preserving existing native settings.
7. **Persistence and versions** — add draft metadata, autosave state, optimistic saves, native version identifiers, and conflict handling.
8. **Simulation** — add a local, side-effect-free preview path and distinguish it from production execution.
9. **Execution observability** — normalize native run, node-run, event, retry, cancel, and approval states into the existing console.
10. **Templates and management** — keep existing plan templates functional and make template metadata version-aware.
11. **Performance** — virtualize or memoize visible graph rendering and keep topology work linear for large graphs.
12. **Accessibility** — add keyboard navigation, focus management, semantic labels, reduced-motion support, and mobile view/basic-edit behavior.
13. **Security hardening** — verify RLS, function authorization, URL restrictions, secret redaction, and tenant isolation.
14. **Regression coverage** — test model normalization, validation, mapping, simulation, persistence adapters, and graph performance.
15. **Migration and rollout** — apply ordered Supabase migrations, deploy edge functions, and verify the builder against a live workspace.
16. **Release hardening** — run typecheck, tests, build, navigation validation, and manual desktop/tablet/mobile checks.

## Guardrails

- Keep `supabase.functions.invoke` and `src/lib/automationBackend.js` as the frontend/backend boundary.
- Keep Deno-only execution and secret handling on the server.
- Do not expose secrets through workflow configs, run logs, or browser state.
- Do not add fake node behavior to make simulation or execution appear successful.
- Do not add a second canvas engine or replace working platform routes.
- Do not make destructive migration changes without a compatibility adapter and an ordered migration.
- Keep comments out of implementation code unless explicitly requested.

## Acceptance criteria

- Existing Starter, Pro, and Enterprise builder flows still load and preserve their current visual identity.
- Functional atoms have explicit typed inputs, outputs, defaults, and validation.
- Invalid graphs identify actionable node/edge issues before execution.
- Large graphs do not cause avoidable full-history or per-frame work.
- Draft and saved state can be distinguished, and version conflicts are surfaced rather than silently overwritten.
- Native runs expose node and execution status through the existing console and never run in simulation mode.
- All available project checks pass: `npm run typecheck`, `npm run test`, `npm run build`, and `npm run validate:navigation`.
