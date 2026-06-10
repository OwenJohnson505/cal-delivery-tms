/**
 * Address-find providers (handover §1 smart address-find, §5 seams).
 *
 * Three sources, behind one interface each so mock and real impls are swappable:
 *   - internal:  customer's saved/used addresses, frequency-ranked (free, type-ahead)
 *   - places:    Google Places Autocomplete (session token, debounced) + Place Details
 *                on select (the billed call)
 *   - postcode:  full-postcode -> address provider (Loqate / getAddress.io / PAF)
 *
 * Selection from any provider must resolve to a normalised Address (types/address.ts).
 */
import type { Address, AddressClass } from '@/types/index.ts'

/** A lightweight prediction shown in the type-ahead list, before full resolution. */
export interface AddressPrediction {
  /** Provider-specific id used to resolve the full address on select. */
  id: string
  /** Primary line shown in the list. */
  primary: string
  /** Secondary line (e.g. locality / postcode context). */
  secondary?: string
  /** Which provider produced this prediction. */
  source: AddressClass
}

/** Internal saved/frequent address book (free, ranked by persisted usage). */
export interface InternalAddressProvider {
  /** Frequency-ranked type-ahead over the customer's saved/used addresses. */
  search(query: string): Promise<AddressPrediction[]>
  /** Resolve a prediction to a full normalised address. */
  resolve(id: string): Promise<Address>
  /** Increment persisted usage count on select (drives ranking). */
  recordUse(id: string): Promise<void>
}

/** Google Places. `sessionToken` ties predictions to the billed Place Details call. */
export interface PlacesAddressProvider {
  /** Debounced Autocomplete predictions for the current session. */
  predict(query: string, sessionToken: string): Promise<AddressPrediction[]>
  /** Place Details on select (billed) -> normalised address. Ends the session. */
  details(placeId: string, sessionToken: string): Promise<Address>
}

/** Postcode -> address lookup (Loqate / getAddress.io / PAF). */
export interface PostcodeAddressProvider {
  /** Return the candidate addresses at a full postcode. */
  lookup(postcode: string): Promise<Address[]>
}

/** The address subsystem's full provider set. */
export interface AddressApi {
  internal: InternalAddressProvider
  places: PlacesAddressProvider
  postcode: PostcodeAddressProvider
}
