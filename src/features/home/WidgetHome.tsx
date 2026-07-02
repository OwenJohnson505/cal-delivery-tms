/**
 * WidgetHome — the iPhone-style home screen. Customizable pages (rail + renamable title),
 * an 8×6 widget grid, a full-screen "add widget" gallery, and a full-width bottom quick-
 * actions bar with page-specific + persistent tools (Calculator / Notepad / Calendar / Timer).
 *
 * Seeded widgets are the current app screens; clicking one launches the real screen.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { usePagesStore, fits, maxAt, HOME_COLS, HOME_ROWS, type HWidget } from '@/store/pagesStore.ts'
import { ListScreen } from '@/features/jobs/ListScreen.tsx'
import { EmailPanel } from '@/features/email/EmailPanel.tsx'
import { CustomersScreen } from '@/features/customers/CustomersScreen.tsx'
import { BookingWizard } from '@/app/BookingWizard.tsx'
import './home.css'

// ── icons ──
const P: Record<string, string> = {
  truck: '<path d="M2 6h11v10H2z"/><path d="M13 9h4l3 3v4h-7z"/><circle cx="6.5" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.2a3 3 0 0 1 0 5.6M21.5 20a6 6 0 0 0-4.2-5.7"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 16v-5M12 16V7M17 16v-3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
  pin: '<path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10Z"/><circle cx="12" cy="11" r="2"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  building: '<path d="M3 21h18M6 21V4a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v17M15 21V9h3a1 1 0 0 1 1 1v11"/><path d="M9 7h2M9 11h2M9 15h2"/>',
  cog: '<circle cx="12" cy="12" r="3.4"/><path d="M12 2v3.4M12 18.6V22M2 12h3.4M18.6 12H22M4.9 4.9l2.4 2.4M16.7 16.7l2.4 2.4M19.1 4.9l-2.4 2.4M7.3 16.7l-2.4 2.4"/>',
  star: '<path d="M12 3l2.6 5.6L21 9.3l-4.5 4.3 1.1 6.4L12 17l-5.6 3 1.1-6.4L3 9.3l6.4-.7z"/>',
  flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.4"/>',
  note: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Z"/><path d="M14 3v5h5"/>',
  phone: '<path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L17 14l5 2v3a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  inbox: '<path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><path d="M4 13h4l1.5 2.5h5L16 13h4"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.5M12 12h.5M16 12v5M8 16h.5M12 16h.5"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 13V9M9 2h6"/>',
  convert: '<path d="M7 4v16M7 4l-3 3M7 4l3 3M17 20V4M17 20l3-3M17 20l-3-3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4-4"/>',
  userplus: '<circle cx="9" cy="8" r="3.4"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M18 8v6M15 11h6"/>',
  navigation: '<path d="M3 11 22 2l-9 19-2-8-8-2Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', close: '<path d="M6 6l12 12M18 6 6 18"/>', edit: '<path d="M5 19h4L19 9l-4-4L5 15v4Z"/><path d="m13.5 6.5 4 4"/>',
  sliders: '<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2.2"/><circle cx="9" cy="16" r="2.2"/>',
  receipt: '<path d="M5 3v18l2-1 2 1 2-1 2 1 2-1 2 1V3l-2 1-2-1-2 1-2-1-2 1-2-1Z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  layers: '<path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  check: '<path d="M5 13l4 4L19 7"/>', chL: '<path d="M15 6l-6 6 6 6"/>', chR: '<path d="M9 6l6 6-6 6"/>',
}
const Ic = ({ k, size = 20 }: { k: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: P[k] || '' }} />
)
const PAGE_ICONS = ['truck', 'mail', 'users', 'chart', 'calendar', 'map', 'building', 'box', 'briefcase', 'flag', 'star', 'cog', 'bolt', 'pin', 'clock', 'inbox', 'grid', 'phone']

// ── widget catalogue — ONLY the finalised screens, one size each. The widget IS the
// interface: the real, fully-functional component renders live inside it. No dummy widgets,
// no invented sizes. (Bookings' compact/expanded is the table's own toggle, not a size.)
type Cat = { nm: string; icon: string; color: string; desc: string; w: number; h: number; render: () => ReactNode }
const CAT: Record<string, Cat> = {
  // sizes on the 24×12 fine grid, tuned to each design's real footprint (see pagesStore seed).
  email: { nm: 'Email', icon: 'mail', color: '#5856d6', desc: 'Inbox, threads & replies', w: 8, h: 12, render: () => <EmailPanel /> },
  bookings: { nm: 'Booking page', icon: 'grid', color: '#0071e3', desc: 'Bookings / quotes / drafts', w: 9, h: 12, render: () => <ListScreen /> },
  customers: { nm: 'Customer screen', icon: 'users', color: '#0a8f6c', desc: 'Accounts & contacts', w: 10, h: 12, render: () => <CustomersScreen /> },
  createbooking: { nm: 'Create booking', icon: 'plus', color: '#ff9500', desc: 'The booking wizard', w: 5, h: 12, render: () => <BookingWizard /> },
}
const TYPE_KEYS = Object.keys(CAT)

// ── the component ──
export function WidgetHome() {
  const { pages, active, pinnedTools, setActive, renamePage, addWidget, removeWidget } = usePagesStore()
  const page = pages[active]

  const [gal, setGal] = useState<{ r: number; c: number } | null>(null)
  const [galType, setGalType] = useState('bookings')
  const [tool, setTool] = useState<{ id: string; x: number; y: number } | null>(null)
  const [cust, setCust] = useState<{ x: number; y: number } | null>(null)
  const [pe, setPe] = useState<{ i: number; x: number; y: number } | null>(null)

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setGal(null); setTool(null); setCust(null); setPe(null) } }
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc)
  }, [])

  const anchorPop = (e: React.MouseEvent) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); return { x: r.left, y: r.top } }

  return (
    <div className="whome">
      <div className="hm-top">
        {/* page rail */}
        <div className="hm-rail">
          {pages.map((p, i) => (
            <div key={p.id} className={'hm-pic' + (i === active ? ' on' : '')} title={p.name}
              onClick={() => setActive(i)} onDoubleClick={(e) => setPe({ i, ...anchorPop(e) })}>
              <Ic k={p.icon} size={24} /><span className="lbl">{p.name}</span>
            </div>
          ))}
          <div className="hm-spring" />
          <button className="hm-add" title="New page" onClick={(e) => setPe({ i: -1, ...anchorPop(e) })}><Ic k="plus" size={22} /></button>
        </div>

        {/* main */}
        <div className="hm-main">
          <div className="hm-phead">
            <input className="hm-pname" spellCheck={false} value={page.name} onChange={(e) => renamePage(active, e.target.value || 'Untitled')} />
            <button className="hm-pedit" title="Rename & icon" onClick={(e) => setPe({ i: active, ...anchorPop(e) })}><Ic k="edit" size={16} /></button>
            <div className="hm-hint">Right-click or double-click any empty space to add a widget</div>
          </div>

          <div className="hm-canvas"
            style={{ gridTemplateColumns: `repeat(${HOME_COLS},minmax(0,1fr))`, gridTemplateRows: `repeat(${HOME_ROWS},minmax(0,1fr))` }}
            onContextMenu={(e) => { const cell = (e.target as HTMLElement).closest('.hm-cell') as HTMLElement | null; if (cell) { e.preventDefault(); setGal({ r: +cell.dataset.r!, c: +cell.dataset.c! }) } }}
            onDoubleClick={(e) => { const cell = (e.target as HTMLElement).closest('.hm-cell') as HTMLElement | null; if (cell) setGal({ r: +cell.dataset.r!, c: +cell.dataset.c! }) }}>
            {Array.from({ length: HOME_ROWS * HOME_COLS }).map((_, i) => { const r = Math.floor(i / HOME_COLS), c = i % HOME_COLS
              return <div key={'c' + i} className="hm-cell" data-r={r} data-c={c} style={{ gridColumn: c + 1, gridRow: r + 1 }} /> })}
            {page.widgets.map((w) => (
              <div key={w.id} className="hm-w" style={{ gridColumn: `${w.col + 1} / span ${w.w}`, gridRow: `${w.row + 1} / span ${w.h}` }}>
                <button className="hm-wx" title="Remove" onClick={(e) => { e.stopPropagation(); removeWidget(w.id) }}><Ic k="close" size={12} /></button>
                <div className="whome-embed">{CAT[w.type]?.render()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* bottom quick-actions bar */}
      <div className="hm-qbar">
        <span className="hm-qlbl">{page.name}</span>
        {page.tools.map((id) => <button key={id} className="hm-qa pg" onClick={(e) => setTool({ id, ...anchorPop(e) })}><Ic k={TOOLS[id]?.icon || 'bolt'} size={17} />{TOOLS[id]?.nm || id}</button>)}
        <span className="hm-qsep" />
        <span className="hm-qlbl">Tools</span>
        {pinnedTools.map((id) => <button key={id} className="hm-qa" onClick={(e) => setTool({ id, ...anchorPop(e) })}><Ic k={TOOLS[id]?.icon || 'bolt'} size={17} />{TOOLS[id]?.nm || id}</button>)}
        <span className="hm-qspring" />
        <button className="hm-qcust" title="Customize quick actions" onClick={(e) => setCust(anchorPop(e))}><Ic k="sliders" size={18} /></button>
      </div>

      {/* full-screen gallery */}
      {gal && <Gallery anchor={gal} galType={galType} setGalType={setGalType} widgets={page.widgets}
        onClose={() => setGal(null)} onAdd={(type) => { const c = CAT[type]; addWidget(type, gal.c, gal.r, c.w, c.h); setGal(null) }} />}

      {/* tool panels */}
      {tool && <ToolPanel tool={tool} onClose={() => setTool(null)} />}
      {cust && <Customize anchor={cust} onClose={() => setCust(null)} />}
      {pe && <PageEditor pe={pe} onClose={() => setPe(null)} />}
    </div>
  )
}

// ── gallery ──
function Gallery({ anchor, galType, setGalType, widgets, onClose, onAdd }: {
  anchor: { r: number; c: number }; galType: string; setGalType: (t: string) => void; widgets: HWidget[]
  onClose: () => void; onAdd: (type: string) => void
}) {
  const { mw, mh } = maxAt(widgets, anchor.c, anchor.r)
  const cat = CAT[galType]
  const cells = HOME_COLS * HOME_ROWS
  const free = cells - widgets.reduce((a, w) => a + Math.min(w.w, HOME_COLS - w.col) * Math.min(w.h, HOME_ROWS - w.row), 0)
  const ok = fits(widgets, anchor.c, anchor.r, cat.w, cat.h)
  // preview scaled to the fine grid so a 12-wide widget doesn't render a 1000px block
  const W = cat.w * 26 + (cat.w - 1) * 4, H = cat.h * 22 + (cat.h - 1) * 4
  return (
    <div className="hm-gal">
      <div className="hm-galtop"><h2>Add a widget</h2>
        <span className="cap">Placing at row {anchor.r + 1}, col {anchor.c + 1} · <b>up to {mw}×{mh}</b> free here · {free} of {cells} cells free</span>
        <button className="x" onClick={onClose}><Ic k="close" size={18} /></button></div>
      <div className="hm-galbody">
        <div className="hm-galtypes">
          {TYPE_KEYS.map((k) => (
            <div key={k} className={'hm-gt' + (k === galType ? ' on' : '')} onClick={() => setGalType(k)}>
              <span className="ic" style={{ background: CAT[k].color }}><Ic k={CAT[k].icon} size={19} /></span>
              <span><div className="nm">{CAT[k].nm}</div><div className="ds">{CAT[k].desc}</div></span>
            </div>
          ))}
        </div>
        <div className="hm-galmain">
          <p className="hm-lead">These are your finalised screens as widgets — the real, workable interface renders live inside. Each has one size for now. You have <b>{mw} wide × {mh} tall</b> free at this spot.</p>
          <div className={'hm-sz' + (ok ? '' : ' no')}>
            <div className="hm-szm"><span className="nm">{cat.nm}</span><span className="dim">{cat.w}×{cat.h}</span>
              <span className={'hm-szb ' + (ok ? 'fit' : 'no')}>{ok ? '✓ Fits here' : `Needs ${cat.w}×${cat.h}`}</span>
              <button className="hm-szadd" disabled={!ok} onClick={() => onAdd(galType)}>{ok ? 'Add to page' : 'Won’t fit'}</button></div>
            <div className="hm-szp hm-szplaceholder" style={{ width: W, height: H }}>
              <span className="hm-szpic" style={{ background: cat.color }}><Ic k={cat.icon} size={26} /></span>
              <span className="hm-szpnm">{cat.nm}</span>
              <span className="hm-szpds">The live {cat.nm.toLowerCase()} — drops in here, fully workable.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── quick-action tools ──
const TOOLS: Record<string, { nm: string; icon: string }> = {
  calc: { nm: 'Calculator', icon: 'calc' }, notepad: { nm: 'Notepad', icon: 'note' }, calendar: { nm: 'Calendar', icon: 'calendar' },
  timer: { nm: 'Timer', icon: 'timer' }, convert: { nm: 'Converter', icon: 'convert' }, search: { nm: 'Search', icon: 'search' },
  assign: { nm: 'Assign driver', icon: 'userplus' }, track: { nm: 'Track fleet', icon: 'navigation' }, newjob: { nm: 'New job', icon: 'plus' },
  route: { nm: 'Route planner', icon: 'map' }, capacity: { nm: 'Capacity', icon: 'layers' }, newquote: { nm: 'New quote', icon: 'receipt' },
  invoice: { nm: 'Raise invoice', icon: 'receipt' }, statement: { nm: 'Statement', icon: 'chart' }, credit: { nm: 'Credit check', icon: 'check' },
}

function ToolPanel({ tool, onClose }: { tool: { id: string; x: number; y: number }; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: -9999, top: -9999 })
  useEffect(() => { const el = ref.current; if (!el) return
    const left = Math.max(10, Math.min(tool.x, window.innerWidth - el.offsetWidth - 10))
    const top = tool.y - el.offsetHeight - 8
    setPos({ left, top: Math.max(10, top) })
  }, [tool])
  const t = TOOLS[tool.id]
  return (<>
    <div className="hm-scrim" onClick={onClose} />
    <div className="hm-pop" ref={ref} style={pos}>
      <div className="hm-poph"><Ic k={t?.icon || 'bolt'} size={15} /> {t?.nm || tool.id}</div>
      {tool.id === 'calc' ? <Calculator /> : tool.id === 'notepad' ? <Notepad /> : tool.id === 'calendar' ? <MiniCal /> : tool.id === 'timer' ? <Timer /> :
        <div className="hm-placeholder">{t?.nm} — a quick tool. We’ll build this out next.</div>}
    </div>
  </>)
}

function Calculator() {
  const [expr, setExpr] = useState('')
  const key = (k: string) => setExpr((x) => {
    if (k === 'C') return ''
    if (k === 'back') return x.slice(0, -1)
    if (k === '=') { try { return String(Function('return ' + (x.replace(/[^-()\d/*+.]/g, '') || '0'))()) } catch { return 'Err' } }
    return x + k
  })
  return (
    <div className="hm-calc">
      <div className="disp">{expr || '0'}</div>
      <div className="keys">
        <button onClick={() => key('C')}>C</button><button className="op" onClick={() => key('/')}>÷</button><button className="op" onClick={() => key('*')}>×</button><button onClick={() => key('back')}>⌫</button>
        <button onClick={() => key('7')}>7</button><button onClick={() => key('8')}>8</button><button onClick={() => key('9')}>9</button><button className="op" onClick={() => key('-')}>−</button>
        <button onClick={() => key('4')}>4</button><button onClick={() => key('5')}>5</button><button onClick={() => key('6')}>6</button><button className="op" onClick={() => key('+')}>+</button>
        <button onClick={() => key('1')}>1</button><button onClick={() => key('2')}>2</button><button onClick={() => key('3')}>3</button><button style={{ gridRow: 'span 2' }} onClick={() => key('.')}>.</button>
        <button style={{ gridColumn: 'span 2' }} onClick={() => key('0')}>0</button><button className="eq" onClick={() => key('=')}>=</button>
      </div>
    </div>
  )
}
function Notepad() {
  const [text, setText] = usePersistNote()
  return <div className="hm-npad"><textarea autoFocus placeholder="Quick notes…" value={text} onChange={(e) => setText(e.target.value)} /></div>
}
let NOTE = ''
function usePersistNote(): [string, (v: string) => void] {
  const [t, setT] = useState(NOTE)
  return [t, (v: string) => { NOTE = v; setT(v) }]
}
function MiniCal() {
  const [ym, setYm] = useState(() => ({ y: 2026, m: 6 })) // July 2026 (0-based month)
  const first = new Date(ym.y, ym.m, 1).getDay() || 7 // Mon=1..Sun=7
  const days = new Date(ym.y, ym.m + 1, 0).getDate()
  const label = new Date(ym.y, ym.m, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
  const cells: (number | null)[] = []
  for (let i = 1; i < first; i++) cells.push(null)
  for (let d = 1; d <= days; d++) cells.push(d)
  const shift = (n: number) => setYm((s) => { const d = new Date(s.y, s.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() } })
  return (
    <div className="hm-minical">
      <div className="mh"><button onClick={() => shift(-1)}><Ic k="chL" size={14} /></button><span>{label}</span><button onClick={() => shift(1)}><Ic k="chR" size={14} /></button></div>
      <div className="g">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <b key={i}>{d}</b>)}
        {cells.map((d, i) => <span key={i} className={d === 9 ? 'on' : ''}>{d ?? ''}</span>)}</div>
    </div>
  )
}
function Timer() {
  const [ms, setMs] = useState(0)
  const [run, setRun] = useState(false)
  useEffect(() => { if (!run) return; const t0 = Date.now() - ms; const id = window.setInterval(() => setMs(Date.now() - t0), 100); return () => window.clearInterval(id) }, [run])
  const s = Math.floor(ms / 1000), mm = String(Math.floor(s / 60)).padStart(2, '0'), ss = String(s % 60).padStart(2, '0'), cs = String(Math.floor((ms % 1000) / 10)).padStart(2, '0')
  return (
    <div className="hm-timer">
      <div className="clock">{mm}:{ss}<span style={{ fontSize: 18, color: 'var(--ink3)' }}>.{cs}</span></div>
      <div className="row">
        <button className="go" onClick={() => setRun((r) => !r)}>{run ? 'Pause' : 'Start'}</button>
        <button onClick={() => { setRun(false); setMs(0) }}>Reset</button>
      </div>
    </div>
  )
}

function Customize({ anchor, onClose }: { anchor: { x: number; y: number }; onClose: () => void }) {
  const { pages, active, pinnedTools, togglePin, setPageTools } = usePagesStore()
  const page = pages[active]
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: -9999, top: -9999 })
  useEffect(() => { const el = ref.current; if (!el) return; setPos({ left: Math.max(10, Math.min(anchor.x, window.innerWidth - el.offsetWidth - 10)), top: Math.max(10, anchor.y - el.offsetHeight - 8) }) }, [anchor])
  const togglePageTool = (id: string) => { const t = page.tools; if (t.includes(id)) setPageTools(active, t.filter((x) => x !== id)); else if (t.length < 3) setPageTools(active, [...t, id]) }
  return (<>
    <div className="hm-scrim" onClick={onClose} />
    <div className="hm-pop" ref={ref} style={pos}>
      <div className="hm-cust">
        <div className="sec">Pinned tools · shown on every page</div>
        {['calc', 'notepad', 'calendar', 'timer', 'convert', 'search'].map((id) => (
          <div key={id} className="opt" onClick={() => togglePin(id)}><Ic k={TOOLS[id].icon} size={17} /><span className="nm">{TOOLS[id].nm}</span><span className={'hm-sw' + (pinnedTools.includes(id) ? ' on' : '')} /></div>
        ))}
        <div className="sec">“{page.name}” page tools · shown first, only on this page</div>
        <div className="note">Pick up to 3 — they change when you switch pages.</div>
        {['assign', 'track', 'newjob', 'route', 'capacity', 'newquote', 'invoice', 'statement', 'credit'].map((id) => (
          <div key={id} className="opt" onClick={() => togglePageTool(id)}><Ic k={TOOLS[id].icon} size={17} /><span className="nm">{TOOLS[id].nm}</span><span className={'hm-sw' + (page.tools.includes(id) ? ' on' : '')} /></div>
        ))}
      </div>
    </div>
  </>)
}

function PageEditor({ pe, onClose }: { pe: { i: number; x: number; y: number }; onClose: () => void }) {
  const { pages, addPage, updatePage, deletePage } = usePagesStore()
  const create = pe.i < 0
  const [name, setName] = useState(create ? 'New page' : pages[pe.i].name)
  const [icon, setIcon] = useState(create ? 'star' : pages[pe.i].icon)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: -9999, top: -9999 })
  useEffect(() => { const el = ref.current; if (!el) return; setPos({ left: Math.min(pe.x + 60, window.innerWidth - 300), top: Math.min(pe.y, window.innerHeight - el.offsetHeight - 10) }) }, [pe])
  const commit = () => { const nm = name.trim() || 'Untitled'; if (create) addPage(nm, icon); else updatePage(pe.i, nm, icon); onClose() }
  return (<>
    <div className="hm-scrim" onClick={onClose} />
    <div className="hm-pe" ref={ref} style={pos}>
      <h4>{create ? 'New page' : 'Edit page'}</h4>
      <label>Name</label><input autoFocus value={name} spellCheck={false} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') commit() }} />
      <label>Icon</label>
      <div className="hm-peic">{PAGE_ICONS.map((k) => <button key={k} className={k === icon ? 'on' : ''} onClick={() => setIcon(k)}><Ic k={k} size={18} /></button>)}</div>
      <div className="hm-pea">{!create && pages.length > 1 && <button onClick={() => { deletePage(pe.i); onClose() }}>Delete</button>}<button className="go" onClick={commit}>{create ? 'Create page' : 'Done'}</button></div>
    </div>
  </>)
}
