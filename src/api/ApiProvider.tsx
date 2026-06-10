/**
 * ApiProvider / useApi — make the Api client available to the component tree.
 *
 * Components call `useApi()` and never construct a client themselves, so the whole app
 * can be pointed at the mock (default) or a real impl from one place (createApi).
 */
import { createContext, useContext, type ReactNode } from 'react'
import type { Api } from './index.ts'
import { createApi } from './createApi.ts'

const ApiContext = createContext<Api | null>(null)

export function ApiProvider({ api, children }: { api?: Api; children: ReactNode }) {
  // Default to the mock; a host can inject a real client for production.
  const client = api ?? createApi()
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>
}

export function useApi(): Api {
  const api = useContext(ApiContext)
  if (!api) throw new Error('useApi must be used within an <ApiProvider>')
  return api
}
