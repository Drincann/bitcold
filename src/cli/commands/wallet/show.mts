import { Command } from 'commander';
import { Wallet } from '../../../domain/wallet.mjs';
import { repositories as repos } from '../../../persistence/repository.mjs';
import { printer } from '../../output/index.mjs';
import prompts from 'prompts'
import { WalletData, StoredWalletData } from '../../../domain/types.mjs';
import { hexSha256 } from '../../../crypto/hash.mjs';
import { ensureCliLevelSecretInitialized } from '../../../env/index.mjs';
import { CliError } from '../../../error/cli-error.mjs';
import { BTC_DERIVATION_PATH_PREFIX } from '../../../crypto/mnemonic.mjs';

export const walletShowCommand = new Command()
  .name('show')
  .description('Show wallet details')

  .command('show <wallet-alias>')
  .option('-p --private', 'Show private keys')
  .option('-m --mnemonic', 'Show mnemonic')

  .action(async (walletAlias, opts, cmd) => {
    try {
      await ensureCliLevelSecretInitialized()

      const walletData = await repos.wallet.getWallet(walletAlias);
      if (walletData === undefined) {
        printer.error(`Wallet with alias '${walletAlias}' not found`);
        return;
      }

      // No passphrase required
      const wallet = await Wallet.from(walletData);
      show(wallet, opts);
    } catch (e: unknown) {
      if (e instanceof CliError) {
        printer.error(e.message)
      }
    }
  })

export function show(wallet: Wallet, opts: { private: boolean, mnemonic: boolean }) {
  printer.info(`[Alias]: ${wallet.alias}`);
  if (opts.mnemonic) printer.info(`[Mnemonic]: ${wallet.mnemonic.words}`);
  printer.info('[Accounts]:');
  [...wallet.accounts.entries()].forEach(([alias, account]) => {
    printer.info(`  ${alias}:`)
    printer.info(
      `    <path> ${BTC_DERIVATION_PATH_PREFIX}/${account.index}`
    )
    const address = account.addresses.BTC
    printer.info(`    <address> ${address.address}`)
    if (opts.private) printer.info(`    <private> ${address.privateKey}`)
  });
}
