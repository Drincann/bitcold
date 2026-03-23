import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';
import { publicToAddress, importPublic } from '@ethereumjs/util'; // 引入 ethereumjs-util
import * as mnemoniclib from 'bip39'
import { Mnemonic } from '../domain/types.mjs';
import { getBtcNetwork } from '../env/index.mjs';

/** BIP44 ETH + BIP84 BTC 前缀；最后一档 `/{index}` 由 `derive` / `derivationPath` 拼接。 */
export const ETH_DERIVATION_PATH_PREFIX = "m/44'/60'/0'/0" as const
export const BTC_DERIVATION_PATH_PREFIX = "m/84'/0'/0'/0" as const

const path = {
  ethPath: ETH_DERIVATION_PATH_PREFIX,
  btcPath: BTC_DERIVATION_PATH_PREFIX
}

export function derivationPath(chain: 'ETH' | 'BTC', index: number): string {
  const base = chain === 'ETH' ? ETH_DERIVATION_PATH_PREFIX : BTC_DERIVATION_PATH_PREFIX
  return `${base}/${index}`
}

const bip32 = BIP32Factory(ecc)

export function generate(
  wordsLengthOrEntropy: 12 | 15 | 18 | 21 | 24 | Buffer,
): string {
  if (wordsLengthOrEntropy instanceof Buffer) {
    const words = mnemoniclib.generateMnemonic(entropyBufferSizeToWords(wordsLengthOrEntropy.length), () => wordsLengthOrEntropy)
    return words
  }

  return mnemoniclib.generateMnemonic(wordsToEntropyBufferSize(wordsLengthOrEntropy as 12 | 15 | 18 | 21 | 24), undefined)
}

/**
 * btc:
 *  - private key: hex wif
 *  - public key: hex
 *  - address: Bech32 (p2wpkh)
 * 
 * eth:
 *  - private key: hex
 *  - public key: hex
 *  - address: hex
 */
export function derive(mnemonic: Mnemonic, index: number): {
  ETH: {
    privateKey: string
    publicKey: string
    address: string
  },
  BTC: {
    privateKey: { hex: string; wif: string }
    publicKey: string
    address: string
  }
} {
  const seed = mnemoniclib.mnemonicToSeedSync(mnemonic.words, mnemonic.passphrase)

  const ethNode = bip32.fromSeed(seed).derivePath(path.ethPath).derive(index)
  const btcNode = bip32.fromSeed(seed).derivePath(path.btcPath).derive(index)

  return {
    ETH: {
      privateKey: paddingHexPrefix(Buffer.from(ethNode.privateKey!).toString('hex')),
      publicKey: Buffer.from(ethNode.publicKey).toString('hex'),
      address: paddingHexPrefix(Buffer.from(publicToAddress(importPublic(ethNode.publicKey))).toString('hex'))
    },
    BTC: {
      privateKey: { hex: Buffer.from(btcNode.privateKey!).toString('hex'), wif: btcNode.toWIF() },
      publicKey: Buffer.from(btcNode.publicKey).toString('hex'),
      address: bitcoin.payments.p2wpkh({ pubkey: Buffer.from(btcNode.publicKey), network: getBtcNetwork() }).address!
    }
  }
}
function paddingHexPrefix(hex: string): string {
  if (!hex.startsWith('0x')) {
    return '0x' + hex
  }

  return hex
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