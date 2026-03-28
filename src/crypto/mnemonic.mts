import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';
import * as mnemoniclib from 'bip39'
import { Mnemonic } from '../domain/types.mjs';
import { getBtcNetwork } from '../env/index.mjs';

export const BTC_DERIVATION_PATH_PREFIX = "m/84'/0'/0'/0" as const

const bip32 = BIP32Factory(ecc)

export function derivationPath(index: number): string {
  return `${BTC_DERIVATION_PATH_PREFIX}/${index}`
}

type MnemonicLength = 12 | 15 | 18 | 21 | 24;

export function generate(
  mnemonicLengthOrEntropyBuffer: MnemonicLength | Buffer,
): string {
  if (mnemonicLengthOrEntropyBuffer instanceof Buffer) {
    return mnemoniclib.generateMnemonic(mnemonicLengthOrEntropyBuffer.length * 8, () => mnemonicLengthOrEntropyBuffer)
  }

  const strength = getWordsStrength(mnemonicLengthOrEntropyBuffer as 12 | 15 | 18 | 21 | 24)
  if (!strength) {
    throw new Error('Invalid mnemonic length')
  }

  return mnemoniclib.generateMnemonic(strength)
}

export function derive(mnemonic: Mnemonic, index: number): {
  privateKey: { hex: string; wif: string }
  publicKey: string
  address: string
} {
  const seed = mnemoniclib.mnemonicToSeedSync(mnemonic.words, mnemonic.passphrase)
  const btcNode = bip32.fromSeed(seed).derivePath(BTC_DERIVATION_PATH_PREFIX).derive(index)

  return {
    privateKey: { hex: Buffer.from(btcNode.privateKey!).toString('hex'), wif: btcNode.toWIF() },
    publicKey: Buffer.from(btcNode.publicKey).toString('hex'),
    address: bitcoin.payments.p2wpkh({ pubkey: Buffer.from(btcNode.publicKey), network: getBtcNetwork() }).address!
  }
}

function getWordsStrength(length: 12 | 15 | 18 | 21 | 24): number | undefined {
  if (length == 12) return 128
  if (length == 15) return 160
  if (length == 18) return 192
  if (length == 21) return 224
  if (length == 24) return 256
}
