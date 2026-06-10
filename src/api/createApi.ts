/**
 * createApi — the single place the app obtains its API client.
 *
 * Default: the fully-working MOCK (dummy data, simulated latency). To go live, pass a
 * real `impl` (your own Api implementation) or a custom `latency`. The UI imports the
 * `Api` interface only, so swapping mock for real touches nothing else.
 *
 *   const api = createApi()                       // mock with realistic latency
 *   const api = createApi({ latency: TEST_LATENCY })  // mock, instant (tests)
 *   const api = createApi({ impl: myRealApi })    // real services
 */
import type { Api } from './index.ts'
import { createMockApi } from './mock/index.ts'
import { DEFAULT_LATENCY, type MockLatency, type ApiEndpoints } from './config.ts'

export interface CreateApiOptions {
  /** Provide a real (or partial-override) Api implementation to replace the mock. */
  impl?: Api
  /** Tune the mock's simulated latency. */
  latency?: MockLatency
  /** Real endpoint/webhook URLs (informational until a real impl reads them). */
  endpoints?: ApiEndpoints
}

export function createApi(options: CreateApiOptions = {}): Api {
  if (options.impl) return options.impl
  return createMockApi(options.latency ?? DEFAULT_LATENCY)
}
