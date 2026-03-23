import { BtcAddress, createBtcAddress } from "./address.mjs";
import * as mnemonicUtil from '../crypto/mnemonic.mjs'
import { Mnemonic } from "./types.mjs";
import { AccountData } from "./types.mjs";

export class Account {
  index: number;
  alias: string;
  addresses: { BTC: BtcAddress; };

  constructor(mnemonic: Mnemonic, index: number, alias: string) {
    this.index = index
    this.alias = alias
    this.addresses = Account.createAddress(mnemonic, index, alias)
  }

  private static createAddress(mnemonic: Mnemonic, index: number, alias: string): {
    BTC: BtcAddress;
  } {
    const keypair = mnemonicUtil.derive(mnemonic, index)
    return {
      BTC: createBtcAddress(alias, keypair.privateKey, keypair.publicKey, keypair.address)
    }
  }

  public static from(mnemonic: Mnemonic, accountData: AccountData): Account {
    return new Account(mnemonic, accountData.index, accountData.alias)
  }

  public serialize(): AccountData {
    return {
      alias: this.alias,
      index: this.index
    }
  }
}
