import QRCode from 'qrcode'
import { Command } from 'commander';
import { Wallet } from '../../../domain/wallet.mjs';
import { dereferenceAddress } from '../../utils/wallet-resolver.mjs';
import { withErrorHandler } from '../../utils/error-handler.mjs';
import { repositories as repos } from '../../../persistence/repository.mjs';
import { printer } from '../../output/index.mjs';
import { ensureCliLevelSecretInitialized } from '../../../env/index.mjs';
import { CliError } from '../../../error/cli-error.mjs';

export const walletReceiveCommand = new Command()
  .name('receive')
  .description('Display a receive address with QR code')

  .command('receive <address-ref>')
  .action(withErrorHandler(async (addressRef: string, opts, cmd) => {
    await ensureCliLevelSecretInitialized()

    const address = (await dereferenceAddress(addressRef)).address
    printer.info(address)
    printer.info('')

    const qr = await QRCode.toString(address, { type: 'terminal', small: true })
    printer.info(qr)
  }))
