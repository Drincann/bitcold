import { BtcAddress, createBtcAddress } from "./address.mjs";
import * as mnemonicUtil from '../crypto/mnemonic.mjs'
import { Mnemonic } from "./types.mjs";
import { AccountData } from "./types.mjs";

export class Account {
  mnemonic: Mnemonic;
  accountIndex: number;
  alias: string;

  constructor(mnemonic: Mnemonic, accountIndex: number, alias: string) {
    this.mnemonic = mnemonic
    this.accountIndex = accountIndex
    this.alias = alias
  }

  public getPublicKey() {
    const { xpub } = mnemonicUtil.getAccountKeys(this.mnemonic, this.accountIndex)
    return xpub
  }

  public getPrivateKey() {
    const { xprv } = mnemonicUtil.getAccountKeys(this.mnemonic, this.accountIndex)
    return xprv
  }

  public deriveAddress(change: number, index: number) {
    return mnemonicUtil.derive(this.mnemonic, this.accountIndex, change, index)
  }

  public static from(mnemonic: Mnemonic, accountData: AccountData): Account {
    return new Account(mnemonic, accountData.accountIndex, accountData.alias)
  }

  public serialize(): AccountData {
    return {
      alias: this.alias,
      accountIndex: this.accountIndex
    }
  }
}
