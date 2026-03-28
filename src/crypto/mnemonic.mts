import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';
import * as mnemoniclib from 'bip39'
import { Mnemonic } from '../domain/types.mjs';
import { getBtcNetwork } from '../env/index.mjs';

export const BIP84_PURPOSE = 84

export function getCoinType(): number {
  const network = getBtcNetwork()
  return network === bitcoin.networks.testnet || network === bitcoin.networks.regtest ? 1 : 0
}

export function getAccountPath(accountIndex: number): string {
  return `m/${BIP84_PURPOSE}'/${getCoinType()}'/${accountIndex}'`
}

export function getAddressPath(accountIndex: number, change: number, addressIndex: number): string {
  return `${getAccountPath(accountIndex)}/${change}/${addressIndex}`
}

const bip32 = BIP32Factory(ecc)

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

export function derive(mnemonic: Mnemonic, accountIndex: number, change: number, index: number): {
  privateKey: { hex: string; wif: string }
  publicKey: string
  address: string
  path: string
} {
  const seed = mnemoniclib.mnemonicToSeedSync(mnemonic.words, mnemonic.passphrase)
  const path = getAddressPath(accountIndex, change, index)
  const btcNode = bip32.fromSeed(seed, getBtcNetwork()).derivePath(path)

  return {
    privateKey: { hex: Buffer.from(btcNode.privateKey!).toString('hex'), wif: btcNode.toWIF() },
    publicKey: Buffer.from(btcNode.publicKey).toString('hex'),
    address: bitcoin.payments.p2wpkh({ pubkey: Buffer.from(btcNode.publicKey), network: getBtcNetwork() }).address!,
    path
  }
}

/**
 * Returns the account-level extended public key (zpub for mainnet, vpub for testnet)
 */
export function getAccountKeys(mnemonic: Mnemonic, accountIndex: number): {
  xpub: string
  xprv: string
} {
  const seed = mnemoniclib.mnemonicToSeedSync(mnemonic.words, mnemonic.passphrase)
  const path = getAccountPath(accountIndex)
  // For BIP84, we use zpub (mainnet) or vpub (testnet) prefix
  const network = getBtcNetwork()
  const isTestnet = network === bitcoin.networks.testnet || network === bitcoin.networks.regtest

  // Manual version byte override for zpub/vpub
  // mainnet: zpub = 0x04b24746, zprv = 0x04b2430c
  // testnet: vpub = 0x045f1cf6, vprv = 0x045f18bc
  const zpubNetwork = {
    ...network,
    bip32: {
      public: isTestnet ? 0x045f1cf6 : 0x04b24746,
      private: isTestnet ? 0x045f18bc : 0x04b2430c
    }
  }

  const accountNode = bip32.fromSeed(seed, zpubNetwork).derivePath(path)
  return {
    xpub: accountNode.neutered().toBase58(),
    xprv: accountNode.toBase58()
  }
}

function getWordsStrength(length: 12 | 15 | 18 | 21 | 24): number | undefined {
  if (length == 12) return 128
  if (length == 15) return 160
  if (length == 18) return 192
  if (length == 21) return 224
  if (length == 24) return 256
}
