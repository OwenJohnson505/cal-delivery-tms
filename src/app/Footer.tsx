/**
 * Footer (prototype lines 553-559): booked-by / our-ref meta, total revenue, and the
 * save actions. In a full booking the operator can save as Draft, Quote, OR Booking
 * directly — jobs aren't always quoted first. In Quick Quote mode only Draft / Quick
 * Quote are offered.
 */
import { useBookingStore } from '@/store/bookingStore.ts'

export function Footer() {
  const jobStatus = useBookingStore((s) => s.jobStatus)
  const setJobStatus = useBookingStore((s) => s.setJobStatus)
  const quickQuote = useBookingStore((s) => s.quickQuote)

  return (
    <div className="footer">
      <div className="foot-meta">
        <div className="foot-field">
          <span className="foot-lbl">Booked by</span>
          <span className="foot-val">Owen Johnson · 06-06-26 18:53</span>
        </div>
        <div className="foot-field">
          <span className="foot-lbl">Our ref</span>
          <span className="foot-val cpx" title="Click to copy">BK-2026-100482</span>
        </div>
      </div>
      <div className="foot-actions">
        <div className="foot-rev">
          <span className="foot-lbl">Total revenue</span>
          <span className="foot-amt">£0.00</span>
        </div>
        <div id="footActions" className="saveas">
          <span className="foot-lbl" style={{ marginRight: 8 }}>Status: {jobStatus}</span>
          {quickQuote ? (
            <>
              <button className="btn" onClick={() => setJobStatus('Draft')}>Save as draft</button>
              <button className="btn primary" onClick={() => setJobStatus('Quick Quote')}>
                Save as Quick Quote
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => setJobStatus('Draft')}>Save draft</button>
              <button className="btn" onClick={() => setJobStatus('Quote')}>Save as quote</button>
              <button className="btn primary" onClick={() => setJobStatus('Booking')}>
                Save as booking
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
