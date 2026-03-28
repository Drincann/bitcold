import { bech32 } from 'bech32'
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { getBtcNetwork } from '../env/index.mjs';

bitcoin.initEccLib(ecc);

export function isNotString(value: unknown): value is undefined {
  return typeof value !== 'string';
}

export function isNotValidRef(address?: unknown): boolean {
  if (typeof address !== 'string' || (address?.trim?.()?.length ?? 0) === 0) {
    return true
  }

  return !isAddressRef(address)
}

export function isNotValidBtcAddressOrRef(address?: unknown): boolean {
  if (typeof address !== 'string' || (address?.trim?.()?.length ?? 0) === 0) {
    return true
  }

  if (isAddressRef(address)) {
    return false
  }

  try {
    bitcoin.address.toOutputScript(address, getBtcNetwork())
    return false
  } catch (e) {
    return true
  }
}

export function isNotValidHex(address: string): boolean {
  return !/^(0x)?[0-9a-fA-F]+$/.test(address)
}

export function isNotInt(value: string): boolean {
  return !/^\d+$/.test(value) || (value.startsWith('0') && value.length > 1)
}

export function isNotNumber(amount: string) {
  return !/^\d+(\.\d+)?$/.test(amount)
}

export function isAddressRef(from: string) {
  // wallet@account or wallet@account:index
  return /^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+(:[0-9]+)?$/.test(from)
}

export function isNotValidBech32(address: string): boolean {
  try {
    bech32.decode(address)
    return false
  } catch (e) {
    return true
  }
}

export function isEmpty(alias: string) {
  return (alias?.length ?? 0) === 0;
}

export function isString(alias: string | undefined) {
  return typeof alias === 'string';
}

export function containsWhite(alias: string) {
  return alias.search(/\s/) !== -1;
}

export function ensureSingleWhiteSpace(value: string): string {
  return value.replaceAll(/\s+/g, ' ')
}

export function wordsSizeOf(mnemonic: string): number {
  return mnemonic.split(' ').length
}

export function notIn(item: number, list: number[]): boolean {
  return !list.includes(item)
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number'
}

export function isValidMnemonicLength(mnemonicLength: number): mnemonicLength is 12 | 15 | 18 | 21 | 24 {
  return _in(mnemonicLength, [12, 15, 18, 21, 24])
}

export function _in(item: number, list: number[]): boolean {
  return !notIn(item, list)
}
