import type { WalletData, StoredWalletData } from "./types.mjs";
import { identity, toMap } from "../utils/fp.mjs";
import { Account } from "./account.mjs";
import { Mnemonic } from "./types.mjs";
import { hexSha256 } from "../crypto/hash.mjs";
import prompts from "prompts";
import { CliParameterError } from "../error/cli-error.mjs";
import { printer } from "../cli/output/index.mjs";

export class Wallet {
  public mnemonic: Mnemonic
  public alias: string;
  public accounts: Map<string, Account> // alias -> Account

  constructor(alias: string, mnemonic: Mnemonic, accounts: Account[]) {
    this.alias = alias
    this.mnemonic = mnemonic
    this.accounts = toMap(accounts, account => account.alias, identity())
  }

  public static generateWithDefaultAccount(alias: string, mnemonic: Mnemonic) {
    return new Wallet(alias, mnemonic, [new Account(mnemonic, 0, 'default')])
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
    const walletData: WalletData = {
      ...data,
      mnemonic: {
        ...data.mnemonic,
        passphrase: undefined
      }
    }

    if (data.mnemonic.hasPassphrase) {
      const result = await prompts({
        type: 'password',
        name: 'value',
        message: 'Enter the wallet "' + data.alias + '" mnemonic passphrase'
      })
      if (typeof result.value !== 'string' || result.value.length === 0) {
        throw new CliParameterError('Passphrase is required');
      }

      if (!await hashMatches(data.mnemonic.passphraseSha256, result.value)) {
        throw new CliParameterError('Passphrase is incorrect');
      }

      walletData.mnemonic.passphrase = result.value
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
        hasPassphrase: isNonEmptyString(this.mnemonic.passphrase),
        passphraseSha256: this.mnemonic.passphrase ? await hexSha256(this.mnemonic.passphrase) : undefined,
        words: this.mnemonic.words,
      },
      accounts: [...this.accounts.values()].map(account => account.serialize())
    }
  }
}

function assignPassphrase(walletData: StoredWalletData, value: string): WalletData {
  return {
    ...walletData,
    mnemonic: {
      ...walletData.mnemonic,
      passphrase: value
    }
  }
}

async function hashMatches(passphraseSha256: string | undefined, value: string): Promise<boolean> {
  return await hexSha256(value) === passphraseSha256;
}

function isNonEmptyString(passphrase: string | undefined): boolean {
  return typeof passphrase === 'string' && passphrase.length > 0;
}

/** Smallest non-negative integer not used by any account (fills gaps before extending). */
function firstUnusedDerivationIndex(used: Set<number>): number {
  let n = 0
  while (used.has(n)) n += 1
  return n
}

