import { Command } from 'commander';
import prompts from 'prompts';
import { repositories as repos } from '../../../persistence/repository.mjs';
import { printer } from '../../output/index.mjs';
import { Wallet } from '../../../domain/wallet.mjs';
import type { Account } from '../../../domain/account.mjs';
import { ensureCliLevelSecretInitialized } from '../../../env/index.mjs';
import { CliError, CliParameterError } from '../../../error/cli-error.mjs';
import { show } from './show.mjs';
import { containsWhite, isEmpty, isString } from '../../../utils/validator.mjs';
import { addressSummary } from '../../../utils/display.mjs';

function checkAccountAlias(alias: string) {
  if (isString(alias) && isEmpty(alias)) {
    throw new CliParameterError('account alias should not be empty')
  }
  if (isString(alias) && containsWhite(alias)) {
    throw new CliParameterError('account alias should not contain white spaces, got: \'' + alias + '\'')
  }
  if (isString(alias) && !/^[a-zA-Z0-9_-]+$/.test(alias)) {
    throw new CliParameterError('account alias should only contain letters, numbers, underscores and hyphens')
  }
}

function generateNextAccountAlias(accounts: Map<string, Account>): string {
  let i = 0
  let name = 'account_' + i
  while (accounts.has(name)) name = 'account_' + ++i
  return name
}

export const walletAccountAddCommand = new Command('add')
  .description('Add a derived account (new ETH/BTC addresses) to an existing wallet')
  .argument('<wallet-alias>', 'Wallet alias')
  .argument('[account-alias]', 'Account alias for wallet@alias (omit for account_0, account_1, …)')
  .option<number>('-i --index <n>', 'BIP44 derivation index (default: smallest unused index from 0)', v => parseInt(v, 10))
  .action(async (walletAlias: string, accountArg: string | undefined, opts: { index?: number }) => {
    try {
      await ensureCliLevelSecretInitialized()

      const walletData = await repos.wallet.getWallet(walletAlias)
      if (walletData === undefined) {
        printer.error(`Wallet with alias '${walletAlias}' not found`)
        return
      }

      const indexOpt = opts.index
      if (indexOpt !== undefined && Number.isNaN(indexOpt)) {
        throw new CliParameterError('Derivation index must be a valid integer')
      }

      const wallet = await Wallet.from(walletData)

      const accountAlias =
        typeof accountArg === 'string' && accountArg.trim().length > 0
          ? accountArg.trim()
          : generateNextAccountAlias(wallet.accounts)
      checkAccountAlias(accountAlias)

      wallet.addAccount(accountAlias, indexOpt)
      await repos.wallet.updateWallet(await wallet.serialize())

      printer.info(`Account '${accountAlias}' added to wallet '${walletAlias}'`)
      show(wallet, { chain: new Set(), private: false, mnemonic: false })
    } catch (e: unknown) {
      if (e instanceof CliError || e instanceof CliParameterError) {
        printer.error(e.message)
      } else {
        printer.error((e as Error)?.message ?? 'unknown error')
      }
    }
  })

export const walletAccountRemoveCommand = new Command('remove')
  .description('Remove an account from a wallet (cannot remove the last account)')
  .argument('<wallet-alias>', 'Wallet alias')
  .argument('<account-alias>', 'Account alias to remove')
  .option('-y --yes', 'Skip confirmation', false)
  .action(async (walletAlias: string, accountAlias: string, opts: { yes: boolean }) => {
    try {
      await ensureCliLevelSecretInitialized()

      const trimmedAccount = accountAlias.trim()
      checkAccountAlias(trimmedAccount)

      const walletData = await repos.wallet.getWallet(walletAlias)
      if (walletData === undefined) {
        printer.error(`Wallet with alias '${walletAlias}' not found`)
        return
      }

      const wallet = await Wallet.from(walletData)
      const account = wallet.accounts.get(trimmedAccount)
      if (account === undefined) {
        printer.error(`Account '${trimmedAccount}' not found in wallet '${walletAlias}'`)
        return
      }

      if (!opts.yes) {
        const result = await prompts({
          type: 'confirm',
          name: 'value',
          message: `Remove account '${trimmedAccount}' from '${walletAlias}' [${addressSummary(account.addresses)}]?`
        })
        if (result.value !== true) {
          return
        }
      }

      wallet.removeAccount(trimmedAccount)
      await repos.wallet.updateWallet(await wallet.serialize())

      printer.info(`Account '${trimmedAccount}' removed from wallet '${walletAlias}'`)
      show(wallet, { chain: new Set(), private: false, mnemonic: false })
    } catch (e: unknown) {
      if (e instanceof CliError || e instanceof CliParameterError) {
        printer.error(e.message)
      } else {
        printer.error((e as Error)?.message ?? 'unknown error')
      }
    }
  })

export const walletAccountCommand = new Command('account')
  .description('Manage accounts (address groups) inside a wallet')
  .addCommand(walletAccountAddCommand)
  .addCommand(walletAccountRemoveCommand)
