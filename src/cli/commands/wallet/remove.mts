import { Command } from 'commander';
import prompts from 'prompts'
import { repositories as repos } from '../../../persistence/repository.mjs';
import { printer } from '../../output/index.mjs';
import { ensureCliLevelSecretInitialized } from '../../../env/index.mjs';
import { CliParameterError } from '../../../error/cli-error.mjs';
import { withErrorHandler } from '../../utils/error-handler.mjs';

export const walletRemoveCommand = new Command()
  .name('remove')
  .description('Remove wallet')

  .argument('<wallet-alias>', 'Wallet alias')
  .option('-y --yes', 'Skip confirmation')

  .action(withErrorHandler(async (walletAlias, opts, cmd) => {
    await ensureCliLevelSecretInitialized()
    const walletData = await repos.wallet.getWallet(walletAlias)
    if (walletData === undefined) {
      throw new CliParameterError(`Wallet with alias '${walletAlias}' not found`);
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
  }))
