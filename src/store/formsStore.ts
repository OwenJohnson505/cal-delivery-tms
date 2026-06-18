/**
 * Forms store — the per-tenant Booking/Screen builder (developer brief §5/§11), adapted
 * to the design reference: configs are plain data ("ScreenConfig") edited by the visual
 * builder and rendered by the runtime renderer. The KERNEL (Job/Stop/Charge in the
 * booking + jobs stores) is never touched by config — only presentation/binding is.
 *
 * Three "live" slots — booking / quote / quickquote — each point at either the built-in
 * ORIGINAL WIZARD (the bespoke hand-built screen we keep) or a custom ScreenForm.
 *
 * Persistence: localStorage for the design reference.
 *   Real impl: a versioned per-tenant config table (Postgres JSONB / Base44 entity),
 *   draft vs published, scoped by tenantId.
 */
import { create } from 'zustand'

export type FormMode = 'booking' | 'quote' | 'quickquote'
export const FORM_MODES: { key: FormMode; label: string }[] = [
  { key: 'booking', label: 'Booking' },
  { key: 'quote', label: 'Quote' },
  { key: 'quickquote', label: 'Quick Quote' },
]

/** The built-in, non-editable bespoke wizard — selectable as a live form. */
export const ORIGINAL_WIZARD = 'wizard'

export type FieldType =
  | 'text' | 'textarea' | 'number' | 'date' | 'datetime'
  | 'dropdown' | 'multiselect' | 'checkbox' | 'currency' | 'address' | 'lookup'

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Text area' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & time' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'address', label: 'Address' },
  { value: 'lookup', label: 'Lookup (entity)' },
]

export interface Rect { x: number; y: number; w: number; h: number }
export interface FormOption { value: string; label: string }

/** Where a field's options come from (brief §6). */
export type DataSourceKind = 'static' | 'customers' | 'drivers' | 'vehicles' | 'customer.addresses' | 'customer.contacts'

export interface FormElement {
  id: string
  /** Stable key used by logic; labels are display-only (brief §5). */
  key: string
  kind: 'field' | 'heading' | 'text' | 'divider'
  layout: Rect
  // field-only
  fieldType?: FieldType
  label?: string
  placeholder?: string
  required?: boolean
  comment?: string
  options?: FormOption[]
  source?: DataSourceKind
  /** Kernel path ("job.customerId", "stop.address") or a custom-field key. */
  binding?: string
  // text/heading-only
  content?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export interface FormPanel {
  id: string
  key: string
  title: string
  layout: Rect
  childLayout: 'free' | 'stack' | 'grid'
  collapsible: boolean
  headerless: boolean
  /** Repeatable group bound to a kernel collection (brief §7), or null. */
  repeat: { collection: 'stops' | 'legs' | 'charges'; min: number; max: number | null; addLabel: string } | null
  children: FormElement[]
}

export interface ScreenForm {
  id: string
  name: string
  canvas: { width: number; height: number }
  panels: FormPanel[]
  updatedAt: string
}

const KEY = 'cd-forms-v1'
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`

/** A small starter form so the builder isn't empty (a basic A→B booking screen). */
function seedForm(): ScreenForm {
  return {
    id: uid('form'),
    name: 'Same-day booking (example)',
    canvas: { width: 940, height: 600 },
    panels: [
      {
        id: uid('panel'), key: 'panel.header', title: 'Customer', layout: { x: 16, y: 16, w: 908, h: 96 },
        childLayout: 'free', collapsible: false, headerless: false, repeat: null,
        children: [
          { id: uid('el'), key: 'field.customer', kind: 'field', fieldType: 'lookup', label: 'Customer', required: true, source: 'customers', binding: 'job.customerId', layout: { x: 14, y: 12, w: 360, h: 56 } },
          { id: uid('el'), key: 'field.ref', kind: 'field', fieldType: 'text', label: 'Your reference', binding: 'job.reference', layout: { x: 390, y: 12, w: 300, h: 56 } },
        ],
      },
      {
        id: uid('panel'), key: 'panel.route', title: 'Route · Stops', layout: { x: 16, y: 128, w: 560, h: 300 },
        childLayout: 'stack', collapsible: false, headerless: false,
        repeat: { collection: 'stops', min: 2, max: null, addLabel: 'Add another address' },
        children: [
          { id: uid('el'), key: 'field.stop.address', kind: 'field', fieldType: 'address', label: 'Address', required: true, source: 'customer.addresses', binding: 'stop.address', layout: { x: 14, y: 12, w: 520, h: 56 } },
          { id: uid('el'), key: 'field.stop.goods', kind: 'field', fieldType: 'text', label: 'Goods', binding: 'stop.goods', layout: { x: 14, y: 76, w: 520, h: 56 } },
        ],
      },
      {
        id: uid('panel'), key: 'panel.service', title: 'Service', layout: { x: 592, y: 128, w: 332, h: 300 },
        childLayout: 'free', collapsible: true, headerless: false, repeat: null,
        children: [
          { id: uid('el'), key: 'field.service', kind: 'field', fieldType: 'dropdown', label: 'Service', source: 'static', options: [{ value: 'Same-day', label: 'Same-day' }, { value: 'Overnight', label: 'Overnight' }, { value: 'Economy', label: 'Economy' }], binding: 'job.customFields.service', layout: { x: 14, y: 12, w: 300, h: 56 } },
          { id: uid('el'), key: 'field.notes', kind: 'field', fieldType: 'textarea', label: 'Notes', binding: 'job.customFields.notes', layout: { x: 14, y: 76, w: 300, h: 110 } },
        ],
      },
    ],
    updatedAt: new Date().toISOString().slice(0, 10),
  }
}

interface Persisted { forms: ScreenForm[]; active: Record<FormMode, string> }
function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Persisted
  } catch { /* ignore */ }
  const f = seedForm()
  // default: every mode runs the original wizard until the admin flips a custom form live
  return { forms: [f], active: { booking: ORIGINAL_WIZARD, quote: ORIGINAL_WIZARD, quickquote: ORIGINAL_WIZARD } }
}

interface FormsState {
  forms: ScreenForm[]
  /** Live form per mode: ORIGINAL_WIZARD or a ScreenForm id. */
  active: Record<FormMode, string>
  createForm(name?: string): string
  duplicateForm(id: string): string
  renameForm(id: string, name: string): void
  deleteForm(id: string): void
  updateForm(id: string, patch: Partial<ScreenForm>): void
  setActive(mode: FormMode, formId: string): void
}

export const useFormsStore = create<FormsState>((set, get) => {
  const persist = () => {
    const { forms, active } = get()
    try { localStorage.setItem(KEY, JSON.stringify({ forms, active })) } catch { /* ignore */ }
  }
  const blankForm = (name: string): ScreenForm => ({
    id: uid('form'), name, canvas: { width: 940, height: 600 },
    panels: [{ id: uid('panel'), key: 'panel.1', title: 'New panel', layout: { x: 16, y: 16, w: 908, h: 220 }, childLayout: 'free', collapsible: false, headerless: false, repeat: null, children: [] }],
    updatedAt: new Date().toISOString().slice(0, 10),
  })
  const init = load()
  return {
    forms: init.forms,
    active: init.active,
    createForm: (name = 'Untitled form') => {
      const f = blankForm(name)
      set((s) => ({ forms: [...s.forms, f] })); persist()
      return f.id
    },
    duplicateForm: (id) => {
      const src = get().forms.find((f) => f.id === id)
      if (!src) return ''
      const copy: ScreenForm = JSON.parse(JSON.stringify({ ...src, id: uid('form'), name: `${src.name} (copy)` }))
      set((s) => ({ forms: [...s.forms, copy] })); persist()
      return copy.id
    },
    renameForm: (id, name) => { set((s) => ({ forms: s.forms.map((f) => (f.id === id ? { ...f, name } : f)) })); persist() },
    deleteForm: (id) => {
      set((s) => ({
        forms: s.forms.filter((f) => f.id !== id),
        // any live slot pointing at a deleted form falls back to the original wizard
        active: Object.fromEntries(Object.entries(s.active).map(([m, v]) => [m, v === id ? ORIGINAL_WIZARD : v])) as Record<FormMode, string>,
      }))
      persist()
    },
    updateForm: (id, patch) => {
      set((s) => ({ forms: s.forms.map((f) => (f.id === id ? { ...f, ...patch, updatedAt: new Date().toISOString().slice(0, 10) } : f)) }))
      persist()
    },
    setActive: (mode, formId) => { set((s) => ({ active: { ...s.active, [mode]: formId } })); persist() },
  }
})
