import { describe, expect, it } from 'vitest'
import { hexToBytes } from './format'

describe('hexToBytes', () => {
  it('decodes a well-known hex sequence', () => {
    const result = hexToBytes('deadbeef')
    expect(result).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
  })

  it('decodes an all-zero sequence', () => {
    expect(hexToBytes('0000')).toEqual(new Uint8Array([0x00, 0x00]))
  })

  it('decodes an all-ff sequence', () => {
    expect(hexToBytes('ffff')).toEqual(new Uint8Array([0xff, 0xff]))
  })

  it('handles uppercase hex characters', () => {
    expect(hexToBytes('DEADBEEF')).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
  })

  it('handles mixed case hex characters', () => {
    expect(hexToBytes('DeAdBeEf')).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
  })

  it('decodes a 64-character agreement ID', () => {
    const hex = '0101010101010101010101010101010101010101010101010101010101010101'
    const result = hexToBytes(hex)
    expect(result).toHaveLength(32)
    expect(result.every((b) => b === 0x01)).toBe(true)
  })

  it('returns an empty Uint8Array for an empty string', () => {
    expect(hexToBytes('')).toEqual(new Uint8Array(0))
  })

  it('returns a single byte for a two-character hex string', () => {
    expect(hexToBytes('ff')).toEqual(new Uint8Array([255]))
    expect(hexToBytes('00')).toEqual(new Uint8Array([0]))
    expect(hexToBytes('0a')).toEqual(new Uint8Array([10]))
  })

  it('round-trips: encoding then decoding produces the original bytes', () => {
    const original = new Uint8Array([1, 2, 3, 4, 255, 0, 128, 64])
    const hex = Array.from(original)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    expect(hexToBytes(hex)).toEqual(original)
  })

  it('throws on an odd-length string', () => {
    expect(() => hexToBytes('abc')).toThrow(/even-length/)
  })

  it('throws on non-hex characters', () => {
    expect(() => hexToBytes('zz')).toThrow(/non-hexadecimal/)
  })

  it('throws on hex with embedded spaces', () => {
    expect(() => hexToBytes('de ad')).toThrow()
  })
})
