/**
 * Requirement rollup row. Source: spec §5 (renderReqs builds [label, scope] rows).
 *
 * Three scopes contribute (spec §5): job (MS.equip.sel / MS.service.sel), stop
 * (stop.svc via STOP_SVC), product (EQ['stopId:itemIndex'] via PRODUCT_EQUIP).
 *
 * KNOWN BUG fixed on port (spec §5.3): EQ is seeded lowercase ({straps:true}) but readers
 * test capitalised PRODUCT_EQUIP keys ('Straps'). lib/requirements normalises casing so
 * product equipment actually rolls up.
 */

/** A single rollup row: a requirement label and the scope description it applies to. */
export interface RequirementRow {
  /** Requirement label, e.g. 'Tail lift', 'Two-man', 'Straps'. */
  label: string
  /** Scope description, e.g. 'whole job', 'all stops', 'Stop 2', or an item summary. */
  scope: string
}
