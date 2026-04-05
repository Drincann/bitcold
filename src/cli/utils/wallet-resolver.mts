import prompts from 'prompts';
import { repositories as repos } from '../../persistence/repository.mjs';
import { Wallet } from '../../domain/wallet.mjs';
import { CliError, CliParameterError } from '../../error/cli-error.mjs';
import type { StoredWalletData } from '../../domain/types.mjs';

export async function loadWalletWithBip39PassphrasePrompt(data: StoredWalletData): Promise<Wallet> {
  const result = await prompts({
    type: 'password',
    name: 'value',
    message: 'Enter the wallet "' + data.alias + '" mnemonic passphrase (leave blank to skip)'
  });

  let passphrase = typeof result.value === 'string' && result.value.length > 0 ? result.value : undefined;

  if (passphrase !== undefined) {
    const confirm = await prompts({
      type: 'password',
      name: 'value',
      message: 'Confirm passphrase'
    });

    if (confirm.value !== passphrase) {
      throw new CliParameterError('Passphrases do not match');
    }
  }

  return Wallet.from(data, passphrase);
}

import { Account } from '../../domain/account.mjs';

export async function dereferenceAddress(addressRef: string): Promise<{ wallet: Wallet, account: Account, index: number }> {
  const [walletAlias, rest] = addressRef.split('@')
  if (!walletAlias || !rest) {
    throw new CliError(`Invalid account reference '${addressRef}', expected format: wallet@account[:index]`)
  }

  const [accountAlias, indexStr] = rest.split(':')
  const index = indexStr ? parseInt(indexStr, 10) : 0

  if (Number.isNaN(index)) {
    throw new CliError(`Invalid index in reference '${addressRef}'`)
  }

  const walletData = await repos.wallet.getWallet(walletAlias)
  if (walletData === undefined) {
    throw new CliError(`Wallet '${walletAlias}' not found`)
  }

  const wallet = await loadWalletWithBip39PassphrasePrompt(walletData)
  const account = wallet.accounts.get(accountAlias)
  if (account === undefined) {
    throw new CliError(`Account '${accountAlias}' not found in wallet '${walletAlias}'`)
  }

  return { wallet, account, index }
}
