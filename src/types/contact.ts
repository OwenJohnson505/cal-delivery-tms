/**
 * Contact — a stop's on-site contact.
 *
 * Source: handover §4 (stop.contact) / spec §2.
 *   contact:{name,tel,email}|null
 */
export interface Contact {
  name: string
  tel: string
  email: string
}
