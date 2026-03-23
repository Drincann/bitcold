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

export function generate(
  wordsLengthOrEntropy: 12 | 15 | 18 | 21 | 24 | Buffer,
): string {
  if (wordsLengthOrEntropy instanceof Buffer) {
    const words = mnemoniclib.generateMnemonic(entropyBufferSizeToWords(wordsLengthOrEntropy.length), () => wordsLengthOrEntropy)
    return words
  }

  return mnemoniclib.generateMnemonic(wordsToEntropyBufferSize(wordsLengthOrEntropy as 12 | 15 | 18 | 21 | 24), undefined)
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

function wordsToEntropyBufferSize(length: 12 | 15 | 18 | 21 | 24): number | undefined {
  if (length == 12) return 128
  if (length == 15) return 160
  if (length == 18) return 192
  if (length == 21) return 224
  if (length == 24) return 256
}

function entropyBufferSizeToWords(length: number): number | undefined {
  if (length == 128) return 12
  if (length == 160) return 15
  if (length == 192) return 18
  if (length == 224) return 21
  if (length == 256) return 24
}
