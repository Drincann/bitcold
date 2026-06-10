import { describe, expect, it } from 'vitest'
import { recoverMnemonicFromSlip39Shares, splitMnemonicToSlip39Shares } from '../src/crypto/slip39.mjs'

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

describe('SLIP-39', () => {
  it('recovers a BIP39 mnemonic from enough single-group shares', () => {
    const shares = splitMnemonicToSlip39Shares(MNEMONIC, 2, 3)

    expect(shares).toHaveLength(3)
    expect(recoverMnemonicFromSlip39Shares([shares[0], shares[2]])).toBe(MNEMONIC)
  })

  it('rejects incomplete share sets', () => {
    const shares = splitMnemonicToSlip39Shares(MNEMONIC, 2, 3)

    expect(() => recoverMnemonicFromSlip39Shares([shares[0]])).toThrow('Not enough SLIP-39 shares')
  })
})
