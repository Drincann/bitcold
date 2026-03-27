import type { WalletData, StoredWalletData } from "./types.mjs";
import { identity, toMap } from "../utils/fp.mjs";
import { Account } from "./account.mjs";
import { Mnemonic } from "./types.mjs";
import prompts from "prompts";
import { CliError, CliParameterError } from "../error/cli-error.mjs";
import { printer } from "../cli/output/index.mjs";
import { repositories as repos } from "../persistence/repository.mjs";
import { BtcAddress } from "./address.mjs";

export class Wallet {
  public mnemonic: Mnemonic
  public alias: string;
  public accounts: Map<string, Account> // alias -> Account

  constructor(alias: string, mnemonic: Mnemonic, accounts: Account[]) {
    this.alias = alias
    this.mnemonic = mnemonic
    this.accounts = toMap(accounts, account => account.alias, identity())
  }

  public static generateWithInitialAccount(alias: string, mnemonic: Mnemonic) {
    return new Wallet(alias, mnemonic, [new Account(mnemonic, 0, 'account_0')])
  }

  public addAccount(accountAlias: string, index?: number): void {
    const normalizedAlias = accountAlias.trim()
    if (this.accounts.has(normalizedAlias)) {
      throw new CliParameterError(`Account '${normalizedAlias}' already exists in wallet '${this.alias}'`)
    }
    const usedIndices = new Set([...this.accounts.values()].map(a => a.index))
    let resolvedIndex: number
    if (index !== undefined) {
      if (!Number.isInteger(index) || index < 0) {
        throw new CliParameterError('Derivation index must be a non-negative integer')
      }
      if (usedIndices.has(index)) {
        throw new CliParameterError(`Derivation index ${index} is already used in this wallet`)
      }
      resolvedIndex = index
    } else {
      resolvedIndex = firstUnusedDerivationIndex(usedIndices)
    }
    this.accounts.set(normalizedAlias, new Account(this.mnemonic, resolvedIndex, normalizedAlias))
  }

  public removeAccount(accountAlias: string): void {
    const normalizedAlias = accountAlias.trim()
    if (!this.accounts.has(normalizedAlias)) {
      throw new CliParameterError(`Account '${normalizedAlias}' not found in wallet '${this.alias}'`)
    }
    if (this.accounts.size <= 1) {
      throw new CliParameterError('Cannot remove the last account in a wallet')
    }
    this.accounts.delete(normalizedAlias)
  }

  public static async from(data: StoredWalletData): Promise<Wallet> {
    const result = await prompts({
      type: 'password',
      name: 'value',
      message: 'Enter the wallet "' + data.alias + '" mnemonic passphrase (leave blank to skip)'
    })

    let passphrase = typeof result.value === 'string' && result.value.length > 0 ? result.value : undefined

    if (passphrase !== undefined) {
      const confirm = await prompts({
        type: 'password',
        name: 'value',
        message: 'Confirm passphrase'
      })

      if (confirm.value !== passphrase) {
        throw new CliParameterError('Passphrases do not match')
      }
    }

    const walletData: WalletData = {
      ...data,
      mnemonic: {
        words: data.mnemonic.words,
        passphrase: passphrase
      }
    }

    return new Wallet(
      walletData.alias,
      walletData.mnemonic,
      walletData.accounts.map(accountData => Account.from(walletData.mnemonic, accountData))
    )
  }

  public async serialize(): Promise<StoredWalletData> {
    return {
      alias: this.alias,
      mnemonic: {
        words: this.mnemonic.words,
      },
      accounts: [...this.accounts.values()].map(account => account.serialize())
    }
  }

  public static async dereference(addressRef: string): Promise<BtcAddress> {
    const [walletAlias, accountAlias] = addressRef.split('@')
    if (!walletAlias || !accountAlias) {
      throw new CliError(`Invalid address reference '${addressRef}', expected format: wallet@account`)
    }

    const walletData = await repos.wallet.getWallet(walletAlias)
    if (walletData === undefined) {
      throw new CliError(`Wallet '${walletAlias}' not found`)
    }

    const wallet = await Wallet.from(walletData)
    const account = wallet.accounts.get(accountAlias)
    if (account === undefined) {
      throw new CliError(`Account '${accountAlias}' not found in wallet '${walletAlias}'`)
    }

    return account.addresses.BTC
  }
}

/** Smallest non-negative integer not used by any account (fills gaps before extending). */
function firstUnusedDerivationIndex(used: Set<number>): number {
  let n = 0
  while (used.has(n)) n += 1
  return n
}

