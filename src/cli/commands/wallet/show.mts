import { Command } from 'commander';
import { Wallet } from '../../../domain/wallet.mjs';
import { withErrorHandler } from '../../utils/error-handler.mjs';
import { repositories as repos } from '../../../persistence/repository.mjs';
import { printer } from '../../output/index.mjs';
import { ensureCliLevelSecretInitialized } from '../../../env/index.mjs';
import { loadWalletWithBip39PassphrasePrompt, dereferenceAddress } from '../../utils/wallet-resolver.mjs';
import { entropyHexOf, getAccountPath } from '../../../crypto/mnemonic.mjs';
import { xpubkeySummary } from '../../../utils/display.mjs';
import { splitMnemonicToSlip39Shares } from '../../../crypto/slip39.mjs';
import { CliParameterError } from '../../../error/cli-error.mjs';

interface WalletShowOptions {
  mnemonic: boolean
  private?: boolean
  entropy?: boolean
  slip39?: boolean
  threshold?: number
  shares?: number
}

export const walletShowCommand = new Command()
  .name('show')
  .description('Show wallet details')

  .argument('<alias-or-address-ref>', 'Wallet alias or wallet@account:index reference')
  .option('-p --private', 'Show private keys')
  .option('-m --mnemonic', 'Show mnemonic')
  .option('--entropy', 'Show wallet mnemonic entropy as hexadecimal')
  .option('--slip-39', 'Show SLIP-39 shares for the wallet mnemonic')
  .option<number>('--threshold <n>', 'SLIP-39 share threshold', value => parseInt(value, 10))
  .option<number>('--shares <n>', 'SLIP-39 share count', value => parseInt(value, 10))

  .action(withErrorHandler(async (ref, opts: WalletShowOptions) => {
    await ensureCliLevelSecretInitialized()
    checkSlip39Options(ref, opts)

    const isAddressRef = ref.includes(':')
    if (isAddressRef) {
      const { wallet, account, index } = await dereferenceAddress(ref)
      const derived = account.deriveAddress(0, index)

      printer.info(`Wallet: ${wallet.alias}`)
      if (opts.mnemonic) printer.info(`Mnemonic: ${wallet.mnemonic.words}`);
      if (opts.entropy) printer.info(`Entropy: 0x${entropyHexOf(wallet.mnemonic.words)}`);
      printer.info(`Account: ${account.alias}`)
      printer.info(`  path    ${derived.path}`)
      printer.info(`  address ${derived.address}`)
      if (opts.private) {
        printer.info(`  pubkey  ${derived.publicKey}`)
        printer.warn(`  privkey ${derived.privateKey.wif} (CAUTION: never share)`)
      }
      return
    }

    const isAccountRef = ref.includes('@')
    if (isAccountRef) {
      const { wallet, account } = await dereferenceAddress(ref)
      wallet.accounts = new Map([[account.alias, account]])
      show(wallet, opts);
      return
    }

    const walletData = await repos.wallet.getWallet(ref);
    if (walletData === undefined) {
      printer.error(`Wallet with alias '${ref}' not found`);
      return;
    }

    const wallet = await loadWalletWithBip39PassphrasePrompt(walletData);
    show(wallet, opts);
  }))


export function show(wallet: Wallet, opts: WalletShowOptions) {
  printer.info(`Wallet: ${wallet.alias}`);
  if (opts.mnemonic) printer.info(`Mnemonic: ${wallet.mnemonic.words}`);
  if (opts.entropy) printer.info(`Entropy: 0x${entropyHexOf(wallet.mnemonic.words)}`);
  [...wallet.accounts.entries()].forEach(([alias, account]) => {
    printer.info(`  ${alias}`)
    printer.info(`    path  ${getAccountPath(account.accountIndex)}`)
    if (opts.private) {
      printer.info(`    xpub  ${account.getPublicKey()}`)
      printer.warn(`    xprv  ${account.getPrivateKey()} (CAUTION: never share)`)
    } else {
      printer.info(`    xpub  ${xpubkeySummary(account.getPublicKey())}`)
    }
  });

  if (opts.slip39) {
    const shares = splitMnemonicToSlip39Shares(wallet.mnemonic.words, opts.threshold!, opts.shares!)
    printer.info('')
    printer.info('SLIP-39:')
    printer.info(`  threshold ${opts.threshold} of ${opts.shares}`)
    printer.warn('  warn      each share is not a BIP39 mnemonic')
    shares.forEach((share, i) => printer.info(`  share_${i + 1}  ${share}`))
  }
}

function checkSlip39Options(ref: string, opts: WalletShowOptions) {
  if (!opts.slip39 && (opts.threshold !== undefined || opts.shares !== undefined)) {
    throw new CliParameterError('--threshold and --shares require --slip-39')
  }
  if (!opts.slip39) {
    return
  }
  if (ref.includes('@') || ref.includes(':')) {
    throw new CliParameterError('--slip-39 can only be used with a wallet alias')
  }
  if (!Number.isInteger(opts.threshold) || !Number.isInteger(opts.shares)) {
    throw new CliParameterError('--slip-39 requires --threshold and --shares')
  }
}
