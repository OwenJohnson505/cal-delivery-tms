import { describe, it, expect } from 'vitest'
import { parseGoods, fmtItem, itemShort, plur, normWU } from './parseGoods.ts'

describe('parseGoods', () => {
  it('extracts qty + unit (capitalised)', () => {
    expect(parseGoods('2 pallets')).toEqual([
      { qty: 2, unit: 'Pallet', wt: '', dim: '', raw: '2 pallets' },
    ])
  })

  it('parses the spec §4.1 example', () => {
    // "2 pallets at 400kg total, 1 box"
    expect(parseGoods('2 pallets at 400kg total, 1 box')).toEqual([
      { qty: 2, unit: 'Pallet', wt: '400 kg (total)', dim: '', raw: '2 pallets at 400kg total' },
      { qty: 1, unit: 'Box', wt: '', dim: '', raw: '1 box' },
    ])
  })

  it('captures "each" weight qualifier', () => {
    expect(parseGoods('3 cages 50kg each')[0]).toMatchObject({
      qty: 3,
      unit: 'Cage',
      wt: '50 kg (each)',
    })
  })

  it('parses dimensions', () => {
    expect(parseGoods('1 crate 120x100x150cm')[0]).toMatchObject({
      unit: 'Crate',
      dim: '120×100×150cm',
    })
  })

  it('resolves number-words and a/an to a quantity', () => {
    expect(parseGoods('two boxes')[0].qty).toBe(2)
    expect(parseGoods('a pallet')[0].qty).toBe(1)
  })

  it('splits on , ; / + & and the word "and"', () => {
    expect(parseGoods('1 box and 2 totes / 3 sacks')).toHaveLength(3)
  })

  it('preserves segments with no recognised unit verbatim', () => {
    expect(parseGoods('loose machine part')).toEqual([
      { qty: null, unit: null, wt: '', dim: '', raw: 'loose machine part' },
    ])
  })

  it('returns [] for empty/whitespace', () => {
    expect(parseGoods('')).toEqual([])
    expect(parseGoods('   ')).toEqual([])
  })
})

describe('fmtItem ("reads as" preview — byte-identical guardrail)', () => {
  it('renders qty × unit with weight/dim detail', () => {
    expect(fmtItem(parseGoods('2 pallets 400kg total')[0])).toMatchInlineSnapshot(
      `"2 × Pallets <span class="pdim">400 kg (total)</span>"`,
    )
  })

  it('shows "weight/size n/a" when neither is present', () => {
    expect(fmtItem(parseGoods('1 box')[0])).toMatchInlineSnapshot(
      `"1 × Box <span class="pdim">weight/size n/a</span>"`,
    )
  })

  it('escapes and passes through raw text for unrecognised segments', () => {
    // no separator chars (, ; / + & "and") so the whole string is one segment
    expect(fmtItem(parseGoods('fragile <stuff>')[0])).toMatchInlineSnapshot(
      `"fragile &lt;stuff&gt;"`,
    )
  })
})

describe('itemShort', () => {
  it('compact pluralised summary', () => {
    expect(itemShort(parseGoods('2 pallets')[0])).toBe('2 pallets')
    expect(itemShort(parseGoods('1 box')[0])).toBe('1 box')
  })
})

describe('helpers', () => {
  it('plur adds es after s/x/z/ch/sh, else s', () => {
    expect(plur('box')).toBe('boxes')
    expect(plur('pallet')).toBe('pallets')
  })
  it('normWU normalises weight units', () => {
    expect(['kgs', 'kilo', 't', 'lb', 'g'].map(normWU)).toEqual(['kg', 'kg', 't', 'lb', 'g'])
  })
})
