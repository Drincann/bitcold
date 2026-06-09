import QRCode from 'qrcode'
import { Command } from 'commander';
import { dereferenceAddress } from '../../utils/wallet-resolver.mjs';
import { withErrorHandler } from '../../utils/error-handler.mjs';
import { printer } from '../../output/index.mjs';
import { ensureCliLevelSecretInitialized } from '../../../env/index.mjs';

export function createWalletReceiveCommand(): Command {
  return new Command()
    .name('receive')
    .description('Display a receive address with QR code')
    .argument('<account-ref>', 'Account reference (wallet@account)')
    .option('--change', 'Use change chain', false)
    .action(withErrorHandler(async (accountRef: string, opts: { change: boolean }) => {
      await ensureCliLevelSecretInitialized()

      const { account, index: refIndex } = await dereferenceAddress(accountRef)
      const derived = account.deriveAddress(opts.change ? 1 : 0, refIndex ?? 0)

      printer.info(`path    ${derived.path}`)
      printer.info(`address ${derived.address}`)
      printer.info('')

      const qr = await QRCode.toString(derived.address, { type: 'terminal', small: true })
      printer.info(qr)
    }))
}

export const walletReceiveCommand = createWalletReceiveCommand()
