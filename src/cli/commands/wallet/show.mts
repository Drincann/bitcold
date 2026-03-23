import { Command } from 'commander';
import { Wallet } from '../../../domain/wallet.mjs';
import { repositories as repos } from '../../../persistence/repository.mjs';
import { printer } from '../../output/index.mjs';
import prompts from 'prompts'
import { WalletData, StoredWalletData } from '../../../domain/types.mjs';
import { hexSha256 } from '../../../crypto/hash.mjs';
import { ensureCliLevelSecretInitialized } from '../../../env/index.mjs';
import { CliError } from '../../../error/cli-error.mjs';
import { derivationPath } from '../../../crypto/mnemonic.mjs';

export const walletShowCommand = new Command()
  .name('show')
  .description('Show wallet details')

  .command('show <wallet-alias>')
  .option<Set<string>>('-c --chain <chain>', 'Show only addresses for a specific chain', (chain) => new Set(chain.split(',').map(c => c.toUpperCase())), new Set())
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

export function show(wallet: Wallet, opts: { chain: Set<string>, private: boolean, mnemonic: boolean }) {
  printer.info(`[Alias]: ${wallet.alias}`);
  if (opts.mnemonic) printer.info(`[Mnemonic]: ${wallet.mnemonic.words}`);
  printer.info('[Accounts]:');
  [...wallet.accounts.entries()].forEach(([alias, account]) => {
    printer.info(`  ${alias}:`)
    printer.info(
      `    path: ETH ${derivationPath('ETH', account.index)} | BTC ${derivationPath('BTC', account.index)}`
    )
    Object.entries(account.addresses).forEach(([network, address]) => {
      if (opts.chain.has(network) || opts.chain.size === 0) {
        printer.info(`    ${network}: <address> ${address.address}`)
        if (opts.private) printer.info(`         <private> ${address.privateKey}`)
      }
    });
  });
}
