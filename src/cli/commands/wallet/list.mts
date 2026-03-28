import { Command } from 'commander';
import { repositories as repos } from '../../../persistence/repository.mjs';
import { withErrorHandler } from '../../utils/error-handler.mjs';
import { printer } from '../../output/index.mjs';
import { ensureCliLevelSecretInitialized } from '../../../env/index.mjs';
import { StoredWalletData } from '../../../domain/types.mjs';
import { CliError } from '../../../error/cli-error.mjs';

export const walletListCommand = new Command()
  .name('list')
  .description('List all wallets')

  .action(withErrorHandler(async (opts, cmd) => {
    await ensureCliLevelSecretInitialized()
    const walletsData = (await repos.wallet.getAllWallets())
    if (walletsData.length === 0) {
      printer.info('No wallets found');
      return;
    }

    for (let i = 0; i < walletsData.length; i++) {
      const walletData = walletsData[i];
      printer.info(`${i}  ${walletData.alias}  [${summary(walletData)}]`);
    }
  }))

function summary(walletData: StoredWalletData) {
  return walletData.accounts.map(a => a.alias).join(', ')
}
