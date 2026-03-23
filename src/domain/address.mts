import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { SignedBtcTransaction, UnsignedBtcTransaction } from "./transaction.mjs";
const ecpair = ECPairFactory(ecc)


export interface Address {
  alias: string
  address: string
  privateKey: string
  publicKey: string
}

export class BtcAddress implements Address {
  alias: string
  address: string
  privateKey: string
  privateKeys: { hex: string; wif: string }
  publicKey: string

  constructor(alias: string, privateKey: { hex: string; wif: string }, publicKey: string, address: string) {
    this.alias = alias
    this.address = address
    this.privateKey = privateKey.wif
    this.privateKeys = privateKey
    this.publicKey = publicKey
  }

  sign(unsigned: UnsignedBtcTransaction): SignedBtcTransaction {
    const keyPair = ecpair.fromPrivateKey(Buffer.from(this.privateKeys.hex, 'hex'))
    const validate = (pubkey: Buffer, msghash: Buffer, signature: Buffer): boolean => ecpair.fromPublicKey(pubkey).verify(msghash, signature)

    for (let i = 0; i < unsigned.tx.inputCount; i++) {
      unsigned.tx.signInput(i, keyPair)
      unsigned.tx.validateSignaturesOfInput(i, validate)
    }
    unsigned.tx.finalizeAllInputs()

    return new SignedBtcTransaction(unsigned.tx.extractTransaction())
  }
}

export function createBtcAddress(
  alias: string,
  privateKey: { hex: string; wif: string }, publicKey: string, address: string
): BtcAddress {
  return new BtcAddress(alias, privateKey, publicKey, address)
}
