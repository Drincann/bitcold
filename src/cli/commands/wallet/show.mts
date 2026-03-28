import { Command } from 'commander';
import { Wallet } from '../../../domain/wallet.mjs';
import { withErrorHandler } from '../../utils/error-handler.mjs';
import { repositories as repos } from '../../../persistence/repository.mjs';
import { printer } from '../../output/index.mjs';
import { ensureCliLevelSecretInitialized } from '../../../env/index.mjs';
import { BTC_DERIVATION_PATH_PREFIX } from '../../../crypto/mnemonic.mjs';
import { loadWalletWithBip39PassphrasePrompt } from '../../utils/wallet-resolver.mjs';

export const walletShowCommand = new Command()
  .name('show')
  .description('Show wallet details')

  .command('show <wallet-alias>')
  .option('-p --private', 'Show private keys')
  .option('-m --mnemonic', 'Show mnemonic')

  .action(withErrorHandler(async (walletAlias, opts, cmd) => {
    await ensureCliLevelSecretInitialized()

    const walletData = await repos.wallet.getWallet(walletAlias);
    if (walletData === undefined) {
      printer.error(`Wallet with alias '${walletAlias}' not found`);
      return;
    }

    const wallet = await loadWalletWithBip39PassphrasePrompt(walletData);
    show(wallet, opts);
  }))

export function show(wallet: Wallet, opts: { private: boolean, mnemonic: boolean }) {
  printer.info(`Wallet: ${wallet.alias}`);
  if (opts.mnemonic) printer.info(`Mnemonic: ${wallet.mnemonic.words}`);
  printer.info('');
  [...wallet.accounts.entries()].forEach(([alias, account]) => {
    const address = account.addresses.BTC
    printer.info(`  ${alias}`)
    printer.info(`    path     ${BTC_DERIVATION_PATH_PREFIX}/${account.index}`)
    printer.info(`    address  ${address.address}`)
    if (opts.private) printer.info(`    private  ${address.privateKey}`)
  });
}
