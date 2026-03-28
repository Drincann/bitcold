import { Command } from 'commander';
import { Wallet } from '../../../domain/wallet.mjs';
import { withErrorHandler } from '../../utils/error-handler.mjs';
import { repositories as repos } from '../../../persistence/repository.mjs';
import { printer } from '../../output/index.mjs';
import { ensureCliLevelSecretInitialized } from '../../../env/index.mjs';
import { loadWalletWithBip39PassphrasePrompt, dereferenceAddress } from '../../utils/wallet-resolver.mjs';
import { getAccountPath } from '../../../crypto/mnemonic.mjs';
import { xpubkeySummary } from '../../../utils/display.mjs';

export const walletShowCommand = new Command()
  .name('show')
  .description('Show wallet details')

  .argument('<alias-or-address-ref>', 'Wallet alias or wallet@account:index reference')
  .option('-p --private', 'Show private keys')
  .option('-m --mnemonic', 'Show mnemonic')

  .action(withErrorHandler(async (ref, opts) => {
    await ensureCliLevelSecretInitialized()

    const isAddressRef = ref.includes(':')
    if (isAddressRef) {
      const { wallet, account, index } = await dereferenceAddress(ref)
      const derived = account.deriveAddress(0, index)

      printer.info(`Wallet: ${wallet.alias}`)
      if (opts.mnemonic) printer.info(`Mnemonic: ${wallet.mnemonic.words}`);
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


export function show(wallet: Wallet, opts: { mnemonic: boolean, private?: boolean }) {
  printer.info(`Wallet: ${wallet.alias}`);
  if (opts.mnemonic) printer.info(`Mnemonic: ${wallet.mnemonic.words}`);
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
}
