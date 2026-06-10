/**
 * Modal host — POD/POB viewer, Docket audit timeline, Documents, and the Customer info
 * pack (prototype openPod / openAudit / openDocs / custInfo). Audit + Docs read the mock
 * API; POD reads the stop's pod; custinfo uses the CUSTINFO fixture.
 */
import { useEffect, useState } from 'react'
import { Icon } from './Icon.tsx'
import { useApi } from '@/api/ApiProvider.tsx'
import { useUiStore } from '@/store/uiStore.ts'
import { useBookingStore } from '@/store/bookingStore.ts'
import { CUSTINFO } from '@/api/mock/data.ts'
import { useCustomersStore, type CustomFieldDef } from '@/store/customersStore.ts'
import type { AuditEntry, BookingDocument } from '@/api/index.ts'
import type { Pod } from '@/types/index.ts'

// Stable empty reference (see Header.tsx) — avoids an infinite render loop.
const NO_FIELDS: CustomFieldDef[] = []

export function Modals() {
  const modal = useUiStore((s) => s.modal)
  const closeModal = useUiStore((s) => s.closeModal)
  if (!modal) return null

  return (
    <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && closeModal()}>
      <div className="modal" id="modalBody">
        {modal === 'pod' && <PodModal />}
        {modal === 'audit' && <AuditModal />}
        {modal === 'docs' && <DocsModal />}
        {modal === 'custinfo' && <CustInfoModal />}
        {modal === 'customfields' && <CustomFieldsModal />}
      </div>
    </div>
  )
}

function ModalHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="modal-h">
      <b>{title}</b>
      <span className="x" onClick={onClose} style={{ marginLeft: 'auto', cursor: 'pointer' }}>✕</span>
    </div>
  )
}

function PodModal() {
  const closeModal = useUiStore((s) => s.closeModal)
  const podStopId = useUiStore((s) => s.podStopId)
  const stop = useBookingStore((s) => s.stops.find((st) => st.id === podStopId))
  const pod: Pod | null = stop?.pod ?? null

  return (
    <>
      <ModalHead title="Proof viewer" onClose={closeModal} />
      <div className="modal-b">
        {!pod ? (
          <div className="hint">No proof recorded for this stop.</div>
        ) : (
          <div className="pod">
            <div className="pod-row">
              <span className="pod-k">Type</span>
              <span>{pod.type === 'POD' ? 'Proof of delivery' : 'Proof of collection'}</span>
            </div>
            <div className="pod-row">
              <span className="pod-k">Source</span>
              <span className={'itag' + (pod.via === 'CX API' ? '' : '')}>{pod.via}</span>
            </div>
            <div className="pod-row"><span className="pod-k">Signed by</span><span>{pod.name}</span></div>
            <div className="pod-row"><span className="pod-k">Captured</span><span>{pod.at} · {pod.by}</span></div>
            <div className="pod-row"><span className="pod-k">Signature</span><span>{pod.sig ? 'Captured' : '—'}</span></div>
            <div className="pod-row"><span className="pod-k">Photos</span><span>{pod.photos}</span></div>
          </div>
        )}
      </div>
    </>
  )
}

function AuditModal() {
  const api = useApi()
  const closeModal = useUiStore((s) => s.closeModal)
  const [entries, setEntries] = useState<AuditEntry[]>([])
  useEffect(() => {
    api.audit.list('job-1').then(setEntries)
  }, [api])

  return (
    <>
      <ModalHead title="Docket · audit trail" onClose={closeModal} />
      <div className="modal-b">
        <div className="timeline">
          {entries.map((e) => {
            const meta = (e.meta || {}) as { icon?: string; detail?: string; pod?: Pod }
            return (
              <div className="tl-item" key={e.id}>
                <span className="tl-ic"><Icon name={meta.icon || 'note'} size={15} /></span>
                <div className="tl-body">
                  <div className="tl-ev">
                    <b>{e.event}</b> <span className="tsep">·</span> {e.actor}
                    <span className="cc-tag" style={{ marginLeft: 6 }}>{e.at}</span>
                  </div>
                  {meta.detail && <div className="tl-detail">{meta.detail}</div>}
                  {meta.pod && (
                    <div className="tl-detail">
                      <span className="itag">{meta.pod.via}</span> {meta.pod.type} · signed by {meta.pod.name}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

function DocsModal() {
  const api = useApi()
  const closeModal = useUiStore((s) => s.closeModal)
  const [docs, setDocs] = useState<BookingDocument[]>([])
  const refresh = () => api.documents.list('job-1').then(setDocs)
  useEffect(() => { refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await api.documents.upload('job-1', file)
    await refresh()
  }

  return (
    <>
      <ModalHead title="Booking documents" onClose={closeModal} />
      <div className="modal-b">
        <label className="btn" style={{ marginBottom: 10, display: 'inline-flex' }}>
          <Icon name="download" size={14} /> Upload document
          <input type="file" hidden onChange={onFile} />
        </label>
        <table>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td><Icon name="file" size={14} /> {d.name}</td>
                <td>{d.stopId ? `Stop ${d.stopId}` : 'Whole job'}</td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    className="btn sm iconbtn"
                    title="Remove"
                    onClick={async () => { await api.documents.remove('job-1', d.id); refresh() }}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {!docs.length && (
              <tr><td className="empty">No documents</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

function CustInfoModal() {
  const closeModal = useUiStore((s) => s.closeModal)
  return (
    <>
      <ModalHead title="Customer info" onClose={closeModal} />
      <div className="modal-b">
        <div className="subhead" style={{ marginBottom: 6 }}>Opening hours</div>
        <table>
          <tbody>
            {CUSTINFO.open.map(([day, hours]) => (
              <tr key={day}><td>{day}</td><td>{hours}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="pod-row" style={{ marginTop: 10 }}><span className="pod-k">Goods in</span><span>{CUSTINFO.goodsIn}</span></div>
        <div className="pod-row"><span className="pod-k">Out of hours</span><span>{CUSTINFO.ooh.name} · {CUSTINFO.ooh.tel}</span></div>
        <div className="pod-row"><span className="pod-k">Site notes</span><span>{CUSTINFO.notes}</span></div>
      </div>
    </>
  )
}

/** A single typed input for a custom field. */
function CustomFieldInput({ field, value, onChange }: { field: CustomFieldDef; value: string; onChange: (v: string) => void }) {
  if (field.type === 'select') {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }
  const type = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'
  return <input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
}

/**
 * Custom fields modal — fill in the selected customer's job- and stop-level fields.
 * Values stage locally and commit to the booking store on Save (Cancel discards), so
 * the route view stays a fixed height no matter how many fields a customer defines.
 */
function CustomFieldsModal() {
  const closeModal = useUiStore((s) => s.closeModal)
  const targetStopId = useUiStore((s) => s.customFieldsStopId)
  const custId = useBookingStore((s) => s.book.cust)
  const stops = useBookingStore((s) => s.stops)
  const customJob = useBookingStore((s) => s.customJob)
  const setCustomJob = useBookingStore((s) => s.setCustomJob)
  const updateStop = useBookingStore((s) => s.updateStop)
  const fields = useCustomersStore((s) => s.customers.find((c) => c.id === custId)?.customFields) ?? NO_FIELDS

  // null target = job-level fields; otherwise just the one stop's stop-level fields.
  const isJob = targetStopId == null
  const stop = isJob ? null : stops.find((s) => s.id === targetStopId)
  const stopIndex = stop ? stops.findIndex((s) => s.id === stop.id) : -1
  const shown = fields.filter((f) => (isJob ? f.scope === 'job' : f.scope === 'stop'))

  const initial = isJob ? customJob : (stop?.custom || {})
  const [vals, setVals] = useState<Record<string, string>>(() => ({ ...initial }))

  const title = isJob
    ? 'Job custom fields'
    : `Stop ${stopIndex + 1} fields${stop && (stop.addr.co || stop.addr.pc) ? ` · ${stop.addr.co || stop.addr.pc}` : ''}`

  function save() {
    if (isJob) {
      shown.forEach((f) => setCustomJob(f.id, vals[f.id] || ''))
    } else if (stop) {
      updateStop(stop.id, { custom: { ...(stop.custom || {}), ...vals } })
    }
    closeModal()
  }

  return (
    <>
      <ModalHead title={title} onClose={closeModal} />
      <div className="modal-b">
        {shown.length === 0 ? (
          <div className="hint">No {isJob ? 'job' : 'stop'} custom fields for this customer.</div>
        ) : (
          <div className="cfm">
            <div className="cfm-grid">
              {shown.map((f) => (
                <div className="fld" key={f.id}>
                  <label>{f.label || 'Untitled'}{f.required && <span className="cfm-req"> *</span>}</label>
                  <CustomFieldInput field={f} value={vals[f.id] || ''} onChange={(v) => setVals((p) => ({ ...p, [f.id]: v }))} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="modal-f">
        <button className="btn" onClick={closeModal}>Cancel</button>
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </>
  )
}
