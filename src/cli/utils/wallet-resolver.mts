import prompts from 'prompts';
import { repositories as repos } from '../../persistence/repository.mjs';
import { Wallet } from '../../domain/wallet.mjs';
import { CliError, CliParameterError } from '../../error/cli-error.mjs';
import { BtcAddress } from '../../domain/address.mjs';
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

export async function dereferenceAddress(addressRef: string): Promise<BtcAddress> {
  const [walletAlias, accountAlias] = addressRef.split('@')
  if (!walletAlias || !accountAlias) {
    throw new CliError(`Invalid address reference '${addressRef}', expected format: wallet@account`)
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

  return account.addresses.BTC
}
