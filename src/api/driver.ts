/**
 * Driver availability + Courier Exchange bid feed (handover §1 driver/providers drawer,
 * §5: DRIVERS/CXBIDS stubs -> driver availability + CX bid feed via poll/websocket).
 *
 * The feed is modelled as a pull (poll) plus an optional subscribe (websocket) so a mock
 * can implement just `list*` and a real impl can add streaming.
 */
import type { Bid, Driver } from '@/types/index.ts'

export interface DriverFeedApi {
  /** Search internal drivers by name or id (inline allocate). */
  searchDrivers(query: string): Promise<Driver[]>
  /** Current internal-driver availability snapshot. */
  listDrivers(): Promise<Driver[]>
  /** Current CX bids for the job. */
  listBids(jobId: string): Promise<Bid[]>
  /**
   * Optional live subscription to bid updates (websocket). Returns an unsubscribe fn.
   * Mocks may omit this.
   */
  subscribeBids?(jobId: string, onBids: (bids: Bid[]) => void): () => void
}
