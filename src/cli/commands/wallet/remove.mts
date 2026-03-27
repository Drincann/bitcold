import { Command } from 'commander';
import prompts from 'prompts'
import { repositories as repos } from '../../../persistence/repository.mjs';
import { printer } from '../../output/index.mjs';
import { ensureCliLevelSecretInitialized } from '../../../env/index.mjs';
import { CliError } from '../../../error/cli-error.mjs';

export const walletRemoveCommand = new Command()
  .name('remove')
  .description('Remove wallet')

  .command('remove <wallet-alias>')
  .option('-y --yes', 'Skip confirmation')

  .action(async (walletAlias, opts, cmd) => {
    try {
      await ensureCliLevelSecretInitialized()
      const walletData = await repos.wallet.getWallet(walletAlias)
      if (walletData === undefined) {
        printer.error(`Wallet with alias '${walletAlias}' not found`);
        return;
      }

      if (!opts.yes) {
        const answer = await prompts({
          type: 'confirm',
          name: 'value',
          message: `Are you sure you want to remove wallet '${walletAlias}' [${walletData.accounts.map(a => a.alias).join(', ')}]?`
        });
        if (!answer.value) return;
      }

      await repos.wallet.remove(walletAlias);
      printer.info(`Wallet '${walletAlias}' removed`);
    } catch (e: unknown) {
      if (e instanceof CliError) {
        printer.error(e.message)
      }
    }
  })
