/**
 * EmailRulesScreen — Settings → Email Rules. The Front-style automation studio: rules
 * (WHEN / IF / THEN, incl. branching), one-click macros, reply templates, and an AI
 * "describe it" builder. Extended with TMS-connected triggers/conditions/actions since
 * we're wired to the booking data. The AI + non-live triggers are mocked.
 */
import { useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import {
  useAutomationStore, aiBuildRule, aiBuildMacro,
  TRIGGERS, COND_FIELDS, ACTION_DEFS, OP_LABEL,
  type AutoRule, type Macro, type Cond, type Act, type ValueType, type Op,
} from '@/store/automationStore.ts'
import { useEmailsStore, EMAIL_STATUSES, MAILBOXES } from '@/store/emailsStore.ts'
import { useUsersStore } from '@/store/usersStore.ts'

const JOB_STATUSES = ['Unallocated', 'Posted', 'Pending', 'Allocated', 'En route COL', 'Collected', 'En route DEL', 'Delivered', 'Part DEL', 'Failed']

const label = (arr: { id: string; label: string }[], id: string) => arr.find((x) => x.id === id)?.label ?? id
function Grouped({ items }: { items: { id: string; label: string; group: string }[] }) {
  const groups = [...new Set(items.map((i) => i.group))]
  return <>{groups.map((g) => <optgroup key={g} label={g}>{items.filter((i) => i.group === g).map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}</optgroup>)}</>
}

function ValueInput({ valueType, value, onChange }: { valueType: ValueType; value?: string; onChange: (v: string) => void }) {
  const users = useUsersStore((s) => s.users)
  const templates = useEmailsStore((s) => s.templates)
  const v = value ?? ''
  const sel = (opts: string[]) => <select className="ar-val" value={v} onChange={(e) => onChange(e.target.value)}><option value="">—</option>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select>
  switch (valueType) {
    case 'none': return <span className="ar-val ar-val-none">—</span>
    case 'user': return <select className="ar-val" value={v} onChange={(e) => onChange(e.target.value)}><option value="">— teammate —</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
    case 'status': return sel([...EMAIL_STATUSES])
    case 'jobstatus': return sel(JOB_STATUSES)
    case 'tier': return sel(['VIP', 'Contract', 'Standard'])
    case 'pickup': return sel(['today', 'tomorrow', 'overdue'])
    case 'sentiment': return sel(['negative', 'neutral', 'positive'])
    case 'newret': return sel(['new', 'returning'])
    case 'mailbox': return sel([...MAILBOXES])
    case 'template': return <select className="ar-val" value={v} onChange={(e) => onChange(e.target.value)}><option value="">— template —</option>{templates.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}</select>
    case 'number': return <input className="ar-val" type="number" value={v} onChange={(e) => onChange(e.target.value)} placeholder="0" />
    default: return <input className="ar-val" value={v} onChange={(e) => onChange(e.target.value)} placeholder="value…" />
  }
}

function CondRows({ conds, onChange }: { conds: Cond[]; onChange: (c: Cond[]) => void }) {
  const set = (i: number, patch: Partial<Cond>) => onChange(conds.map((c, ix) => (ix === i ? { ...c, ...patch } : c)))
  return (
    <div className="ar-rows">
      {conds.map((c, i) => {
        const fld = COND_FIELDS.find((f) => f.id === c.field) ?? COND_FIELDS[0]
        return (
          <div className="ar-row" key={i}>
            <select className="ar-field" value={c.field} onChange={(e) => { const nf = COND_FIELDS.find((f) => f.id === e.target.value)!; set(i, { field: nf.id, op: nf.ops[0], value: '' }) }}><Grouped items={COND_FIELDS} /></select>
            <select className="ar-op" value={c.op} onChange={(e) => set(i, { op: e.target.value as Op })}>{fld.ops.map((o) => <option key={o} value={o}>{OP_LABEL[o]}</option>)}</select>
            <ValueInput valueType={fld.valueType} value={c.value} onChange={(v) => set(i, { value: v })} />
            <button className="btn sm iconbtn danger" onClick={() => onChange(conds.filter((_, ix) => ix !== i))}><Icon name="trash" size={12} /></button>
          </div>
        )
      })}
      <button className="cm-link" onClick={() => onChange([...conds, { field: 'body', op: 'contains', value: '' }])}>+ condition</button>
    </div>
  )
}

function ActRows({ acts, onChange }: { acts: Act[]; onChange: (a: Act[]) => void }) {
  const set = (i: number, patch: Partial<Act>) => onChange(acts.map((a, ix) => (ix === i ? { ...a, ...patch } : a)))
  return (
    <div className="ar-rows">
      {acts.map((a, i) => {
        const def = ACTION_DEFS.find((d) => d.id === a.type) ?? ACTION_DEFS[0]
        return (
          <div className="ar-row" key={i}>
            <select className="ar-field" value={a.type} onChange={(e) => set(i, { type: e.target.value, value: '' })}><Grouped items={ACTION_DEFS} /></select>
            <ValueInput valueType={def.valueType} value={a.value} onChange={(v) => set(i, { value: v })} />
            <button className="btn sm iconbtn danger" onClick={() => onChange(acts.filter((_, ix) => ix !== i))}><Icon name="trash" size={12} /></button>
          </div>
        )
      })}
      <button className="cm-link" onClick={() => onChange([...acts, { type: 'add_tag', value: '' }])}>+ action</button>
    </div>
  )
}

function RuleEditor({ rule, onSave, onClose }: { rule: AutoRule; onSave: (r: AutoRule) => void; onClose: () => void }) {
  const [r, setR] = useState<AutoRule>(rule)
  const patch = (p: Partial<AutoRule>) => setR((x) => ({ ...x, ...p }))
  return (
    <div className="ar-editor">
      <div className="ar-ed-h">
        <button className="btn sm" onClick={onClose}>‹ All rules</button>
        <input className="ar-name" value={r.name} onChange={(e) => patch({ name: e.target.value })} />
        <span className="db-spacer" />
        <button className="btn primary" onClick={() => { onSave(r); onClose() }}>Save rule</button>
      </div>
      <div className="ar-ed-body">
        <div className="ar-block"><div className="ar-block-h">WHEN</div>
          <select className="ar-trigger" value={r.trigger} onChange={(e) => patch({ trigger: e.target.value })}><Grouped items={TRIGGERS} /></select>
          {!TRIGGERS.find((t) => t.id === r.trigger)?.live && <span className="ar-mock">structural — runs in a real backend</span>}
        </div>

        {r.branches?.length ? (
          <div className="ar-block"><div className="ar-block-h">BRANCHES <span className="cf-hint">each branch fires its own actions</span></div>
            {r.branches.map((b, bi) => (
              <div className="ar-branch" key={b.id}>
                <input className="ar-branch-name" value={b.name} onChange={(e) => patch({ branches: r.branches!.map((x, ix) => ix === bi ? { ...x, name: e.target.value } : x) })} />
                <div className="ar-sub">IF</div>
                <CondRows conds={b.conditions} onChange={(c) => patch({ branches: r.branches!.map((x, ix) => ix === bi ? { ...x, conditions: c } : x) })} />
                <div className="ar-sub">THEN</div>
                <ActRows acts={b.actions} onChange={(a) => patch({ branches: r.branches!.map((x, ix) => ix === bi ? { ...x, actions: a } : x) })} />
                <button className="cm-link danger" onClick={() => patch({ branches: r.branches!.filter((_, ix) => ix !== bi) })}>remove branch</button>
              </div>
            ))}
            <button className="cm-link" onClick={() => patch({ branches: [...r.branches!, { id: 'b-' + Math.random().toString(36).slice(2, 7), name: 'Branch', conditions: [{ field: 'body', op: 'contains', value: '' }], actions: [{ type: 'add_tag', value: '' }] }] })}>+ branch</button>
          </div>
        ) : (
          <>
            <div className="ar-block"><div className="ar-block-h">IF
              <select className="ar-match" value={r.match} onChange={(e) => patch({ match: e.target.value as 'all' | 'any' })}><option value="all">match all</option><option value="any">match any</option></select>
            </div>
              <CondRows conds={r.conditions} onChange={(c) => patch({ conditions: c })} />
            </div>
            <div className="ar-block"><div className="ar-block-h">THEN</div>
              <ActRows acts={r.actions} onChange={(a) => patch({ actions: a })} />
            </div>
            <button className="cm-link" onClick={() => patch({ branches: [{ id: 'b1', name: 'Branch A', conditions: r.conditions.length ? r.conditions : [{ field: 'body', op: 'contains', value: '' }], actions: r.actions.length ? r.actions : [{ type: 'add_tag', value: '' }] }] })}>Convert to branching rule →</button>
          </>
        )}
      </div>
    </div>
  )
}

function summarize(r: AutoRule): string {
  const trig = label(TRIGGERS, r.trigger)
  if (r.branches?.length) return `When ${trig} · ${r.branches.length} branches`
  const conds = r.conditions.map((c) => `${label(COND_FIELDS, c.field)} ${OP_LABEL[c.op]} ${c.value ?? ''}`).join(r.match === 'all' ? ' AND ' : ' OR ')
  const acts = r.actions.map((a) => label(ACTION_DEFS, a.type)).join(', ')
  return `When ${trig}${conds ? ` · if ${conds}` : ''}${acts ? ` · then ${acts}` : ''}`
}

export function EmailRulesScreen() {
  const { rules, macros, lastRun, addRule, updateRule, deleteRule, addMacro, updateMacro, deleteMacro, runRulesOnInbox } = useAutomationStore()
  const templates = useEmailsStore((s) => s.templates)
  const addTemplate = useEmailsStore((s) => s.addTemplate)
  const deleteTemplate = useEmailsStore((s) => s.deleteTemplate)

  const [tab, setTab] = useState<'rules' | 'macros' | 'templates'>('rules')
  const [editId, setEditId] = useState<string | null>(null)
  const [ai, setAi] = useState('')
  const [aiNote, setAiNote] = useState('')
  const [ranNote, setRanNote] = useState('')
  const [tName, setTName] = useState(''); const [tBody, setTBody] = useState('')
  const [mEdit, setMEdit] = useState<Macro | null>(null)

  const editing = rules.find((r) => r.id === editId)
  if (editing) return <div className="list-app"><div className="ar-screen"><RuleEditor rule={editing} onSave={(r) => updateRule(r.id, r)} onClose={() => setEditId(null)} /></div></div>

  const buildAi = () => {
    if (!ai.trim()) return
    if (tab === 'macros') { const { macro, rationale } = aiBuildMacro(ai); addMacro(macro); setMEdit(macro); setAiNote(rationale) }
    else { const { rule, rationale } = aiBuildRule(ai); addRule(rule); setEditId(rule.id); setAiNote(rationale) }
    setAi('')
  }

  return (
    <div className="list-app">
      <div className="ar-screen">
        <div className="bk-tabsrow">
          <h2 className="screen-title">Email automation</h2>
          <span className="db-spacer" />
          {tab === 'rules' && <button className="btn" onClick={() => { const fired = runRulesOnInbox(); setRanNote(`Ran rules — ${fired} fired`) }} title="Apply enabled rules to the current inbox">▶ Run on inbox</button>}
        </div>
        <div className="ar-tabs">
          {(['rules', 'macros', 'templates'] as const).map((t) => (
            <button key={t} className={'list-tab' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)} <span className="list-tab-n">{t === 'rules' ? rules.length : t === 'macros' ? macros.length : templates.length}</span></button>
          ))}
        </div>

        {tab !== 'templates' && (
          <div className="ar-ai">
            <span className="ar-ai-spark">✨</span>
            <input className="ar-ai-input" placeholder={tab === 'rules' ? 'Describe a rule… e.g. “when a job is delivered, send the feedback template and mark awaiting customer”' : 'Describe a macro… e.g. “reply with POD and resolve”'} value={ai} onChange={(e) => setAi(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') buildAi() }} />
            <button className="btn primary" onClick={buildAi} disabled={!ai.trim()}>Build with AI</button>
          </div>
        )}
        {aiNote && <div className="ar-ai-note">🤖 {aiNote}</div>}
        {ranNote && tab === 'rules' && <div className="ar-ran">{ranNote}{lastRun ? ` · ${lastRun}` : ''} — check the threads' internal comments for what each rule did.</div>}

        {tab === 'rules' && (
          <>
            <div className="ar-newrow"><button className="btn sm" onClick={() => { const r: AutoRule = { id: 'r-' + Math.random().toString(36).slice(2, 7), name: 'New rule', enabled: true, trigger: 'inbound', match: 'all', conditions: [{ field: 'body', op: 'contains', value: '' }], actions: [{ type: 'add_tag', value: '' }], source: 'manual' }; addRule(r); setEditId(r.id) }}><Icon name="plus" size={13} /> New rule</button><span className="cf-hint">Front-style WHEN / IF / THEN, plus TMS triggers &amp; conditions.</span></div>
            {rules.map((r) => (
              <div className={'ar-card' + (r.enabled ? '' : ' off')} key={r.id}>
                <label className="ar-toggle"><input type="checkbox" checked={r.enabled} onChange={(e) => updateRule(r.id, { enabled: e.target.checked })} /></label>
                <div className="ar-card-main">
                  <div className="ar-card-name">{r.name}{r.source === 'ai' && <span className="ar-badge ai">AI</span>}{r.branches?.length ? <span className="ar-badge">branching</span> : null}</div>
                  <div className="ar-card-sum">{summarize(r)}</div>
                </div>
                <button className="btn sm" onClick={() => setEditId(r.id)}><Icon name="edit" size={13} /> Edit</button>
                <button className="btn sm iconbtn danger" onClick={() => { if (confirm(`Delete rule “${r.name}”?`)) deleteRule(r.id) }}><Icon name="trash" size={13} /></button>
              </div>
            ))}
          </>
        )}

        {tab === 'macros' && (
          <>
            <div className="ar-newrow"><button className="btn sm" onClick={() => { const m: Macro = { id: 'm-' + Math.random().toString(36).slice(2, 7), name: 'New macro', icon: '⚡', actions: [{ type: 'add_tag', value: '' }] }; addMacro(m); setMEdit(m) }}><Icon name="plus" size={13} /> New macro</button><span className="cf-hint">One-click actions an agent runs on a conversation.</span></div>
            {macros.map((m) => (
              <div className="ar-card" key={m.id}>
                <span className="ar-macro-ico">{m.icon ?? '⚡'}</span>
                <div className="ar-card-main">
                  <div className="ar-card-name">{m.name}</div>
                  <div className="ar-card-sum">{m.actions.map((a) => label(ACTION_DEFS, a.type)).join(' · ') || 'no actions'}</div>
                </div>
                <button className="btn sm" onClick={() => setMEdit(m)}><Icon name="edit" size={13} /> Edit</button>
                <button className="btn sm iconbtn danger" onClick={() => { if (confirm(`Delete macro “${m.name}”?`)) deleteMacro(m.id) }}><Icon name="trash" size={13} /></button>
              </div>
            ))}
            {mEdit && (
              <div className="ar-editor ar-macro-editor">
                <div className="ar-ed-h"><b>Edit macro</b><input className="ar-name" value={mEdit.name} onChange={(e) => setMEdit({ ...mEdit, name: e.target.value })} /><span className="db-spacer" /><button className="btn primary" onClick={() => { updateMacro(mEdit.id, mEdit); setMEdit(null) }}>Save</button><button className="btn sm" onClick={() => setMEdit(null)}>Close</button></div>
                <div className="ar-block"><div className="ar-block-h">Actions</div><ActRows acts={mEdit.actions} onChange={(a) => setMEdit({ ...mEdit, actions: a })} /></div>
              </div>
            )}
          </>
        )}

        {tab === 'templates' && (
          <>
            <p className="cf-hint" style={{ margin: '0 0 12px' }}>Reusable replies, inserted in the composer and by “reply using template” actions.</p>
            {templates.map((t) => (
              <div className="ar-card" key={t.id}>
                <div className="ar-card-main"><div className="ar-card-name">{t.name}</div><div className="ar-card-sum">{t.body.replace(/\s+/g, ' ').slice(0, 90)}…</div></div>
                <button className="btn sm iconbtn danger" onClick={() => deleteTemplate(t.id)}><Icon name="trash" size={13} /></button>
              </div>
            ))}
            <div className="ar-tpl-new">
              <input placeholder="Template name…" value={tName} onChange={(e) => setTName(e.target.value)} />
              <textarea rows={3} placeholder="Template body…" value={tBody} onChange={(e) => setTBody(e.target.value)} />
              <button className="btn sm primary" disabled={!tName.trim() || !tBody.trim()} onClick={() => { addTemplate(tName.trim(), tBody); setTName(''); setTBody('') }}>Add template</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
