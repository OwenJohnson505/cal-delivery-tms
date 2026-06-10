/**
 * App shell — placeholder.
 *
 * Per the handover migration strategy, the UI is rebuilt subsystem by subsystem
 * (Route/Stops -> Address -> Goods -> Service -> Driver -> CX -> POD -> Audit/Docs)
 * AFTER the pure logic in src/lib/ is ported and tested. This component is an
 * intentionally empty shell so the scaffold runs; do not build UI here until the
 * prototype (reference/booking-form-modern.html) is on disk and the lib/ modules
 * are ported.
 */
export function App() {
  return (
    <main style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
      <h1>Cal Delivery — Booking Wizard</h1>
      <p>
        Scaffold is up. Pure-logic modules in <code>src/lib/</code> are stubbed and
        awaiting the prototype as their behavioural source of truth. See{' '}
        <code>reference/README.md</code>.
      </p>
    </main>
  )
}
