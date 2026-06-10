/**
 * Customer reference field with a history button (prototype custRef + refHistory). The
 * history button lists what the customer used for their PO/ref on previous jobs, so the
 * operator can reuse one. Refs come from the selected account (mock CUSTOMERS data).
 */
import { useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'
import { CUSTOMERS } from '@/api/mock/data.ts'

export function RefHistory() {
  const custId = useBookingStore((s) => s.book.cust)
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)

  const refs = custId ? CUSTOMERS.find((c) => c.id === custId)?.refs ?? [] : []

  return (
    <div className="fld bar-ref">
      <label>Cust. Ref</label>
      <div className="cb">
        <input
          type="text"
          id="custRef"
          autoComplete="off"
          placeholder="PO / reference…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          type="button"
          className="btn sm iconbtn"
          title="Reference history — what this customer used before"
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name="clock" size={15} />
        </button>
        <div className={'cb-menu' + (open ? ' open' : '')}>
          {!custId ? (
            <div className="cb-opt">Select a customer to see their previous refs.</div>
          ) : refs.length ? (
            refs.map((r) => (
              <div
                key={r}
                className="cb-opt"
                onMouseDown={() => {
                  setValue(r)
                  setOpen(false)
                }}
              >
                {r}
              </div>
            ))
          ) : (
            <div className="cb-opt">No previous references for this customer.</div>
          )}
        </div>
      </div>
    </div>
  )
}
