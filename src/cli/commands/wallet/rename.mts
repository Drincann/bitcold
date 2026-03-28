import { Command } from 'commander';
import { repositories as repos } from '../../../persistence/repository.mjs';
import { withErrorHandler } from '../../utils/error-handler.mjs';
import { printer } from '../../output/index.mjs';
import { ensureCliLevelSecretInitialized } from '../../../env/index.mjs';
import { CliError } from '../../../error/cli-error.mjs';

export const walletRenameCommand = new Command()
  .name('rename')
  .description('Rename a wallet')

  .argument('<old-alias>', 'Old wallet alias')
  .argument('<new-alias>', 'New wallet alias')
  .action(withErrorHandler(async (fromWallet: string, toWallet: string, opts, cmd) => {
    await ensureCliLevelSecretInitialized()
      const fromWalletData = await repos.wallet.getWallet(fromWallet)
      const toWalletData = await repos.wallet.getWallet(toWallet)
      if (fromWalletData === undefined) {
        printer.error(`Wallet '${fromWallet}' not found`);
        return;
      }

      if (toWalletData !== undefined) {
        printer.error(`Wallet '${toWallet}' already exists`);
        return;
      }

      await repos.wallet.rename(fromWallet, toWallet);
      printer.info(`Wallet '${fromWallet}' renamed to '${toWallet}'`);
  }))


