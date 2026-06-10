import { Command } from 'commander';
import prompts from 'prompts';
import { repositories as repos } from '../../../persistence/repository.mjs';
import { CliParameterError } from '../../../error/cli-error.mjs';
import { printer } from '../../output/index.mjs';
import * as mnemonicUtil from '../../../crypto/mnemonic.mjs'
import assert from 'assert';
import { Wallet } from '../../../domain/wallet.mjs';
import { withErrorHandler } from '../../utils/error-handler.mjs';
import { ensureCliLevelSecretInitialized } from '../../../env/index.mjs';
import { containsWhite, ensureSingleWhiteSpace, isEmpty, isNumber, isString, isValidMnemonicLength, notIn, wordsSizeOf } from '../../../utils/validator.mjs';
import { recoverMnemonicFromSlip39Shares } from '../../../crypto/slip39.mjs';

interface WalletCreateParams {
  alias?: string
  mnemonic?: string
  mnemonicLength: number
  passphrase?: string
  showMnemonic?: boolean
  entropy?: string
  fromSlip39?: boolean
  share?: string[]
}

export const walletCreateCommand = new Command()
  .name('create')
  .description('Create a new wallet')

  .argument('[wallet-alias]', 'Alias for the wallet')
  .option('-m --mnemonic <mnemonic> ', 'Create a wallet from a mnemonic')
  .option<number>('-l --mnemonic-length <length> ', 'Length of the mnemonic you want to generate', length => parseInt(length), 12)
  .option('-p --passphrase <passphrase>', 'Passphrase for the mnemonic (never saved, used for derivation preview only)')
  .option('-s --show-mnemonic', 'Show the mnemonic after creating the wallet', false)
  .option('-e --entropy <entropy>', 'Entropy for the wallet, use hex (0x...) or binary (0b...), 128/160/192/224/256 bits')
  .option('--from-slip-39', 'Create a wallet from SLIP-39 shares', false)
  .option('--share <share>', 'SLIP-39 share, can be specified multiple times (interactive prompt is used when omitted)', (value: string, previous: string[]) => {
    const list = Array.isArray(previous) ? previous : []
    list.push(value)
    return list
  }, [] as string[])

  .action(withErrorHandler(async (alias: string | undefined, opts: WalletCreateParams) => {
    if (alias) {
      opts.alias = alias
    }
    await ensureCliLevelSecretInitialized()
    fix(opts)
    await ensureSlip39Shares(opts)
    check(opts); assert(opts.fromSlip39 || opts.entropy != undefined || isValidMnemonicLength(opts.mnemonicLength))

    const walletName = opts.alias ?? await generateNextWalletName()
    await checkNameUnique(opts, walletName);

    const mnemonic = {
      words: resolveMnemonicWords(opts),
      passphrase: opts.passphrase
    }

    const wallet: Wallet = Wallet.generateWithInitialAccount(walletName, mnemonic)

    if (opts.showMnemonic) {
      printer.warn('warn: mnemonic shown in console, keep it safe')
      printer.info('Mnemonic: ' + mnemonic.words)
    }

    printer.info(`Wallet '${wallet.alias}' created!`)
    await repos.wallet.save(await wallet.serialize())
  }))

async function checkNameUnique(opts: WalletCreateParams, walletName: string) {
  const existingWallet = await repos.wallet.getWallet(walletName);
  if (existingWallet !== undefined) {
    throw new CliParameterError(`wallet alias '${walletName}' already exists`);
  }
}

function toEntropyBuffer(entropy?: string): Buffer | undefined {
  if (entropy == undefined) {
    return undefined
  }

  if (/^0x[0-9a-f]+$/i.test(entropy)) {
    return Buffer.from(entropy.slice(2), 'hex')
  }

  const bits = entropy.slice(2)
  const byteLength = bits.length / 8
  const buffer = Buffer.alloc(byteLength)
  for (let i = 0; i < byteLength; i++) {
    buffer[i] = parseInt(bits.slice(i * 8, (i + 1) * 8), 2)
  }
  return buffer
}

function check(opts: WalletCreateParams) {
  checkWalletAlias(opts.alias)
  checkSlip39Options(opts)
  checkMnemonic(opts.mnemonic)
  if (opts.entropy != undefined) {
    checkEntropy(opts.entropy)
  } else {
    checkMnemonicLengthToGenerate(opts.mnemonicLength)
  }
}

function checkSlip39Options(opts: WalletCreateParams) {
  const shares = opts.share ?? []
  if (!opts.fromSlip39 && shares.length > 0) {
    throw new CliParameterError('--share requires --from-slip-39')
  }
  if (!opts.fromSlip39) {
    return
  }
  if (opts.mnemonic !== undefined || opts.entropy !== undefined) {
    throw new CliParameterError('--from-slip-39 cannot be used with --mnemonic or --entropy')
  }
  if (shares.length === 0) {
    throw new CliParameterError('--from-slip-39 requires at least one SLIP-39 share')
  }
}

function checkWalletAlias(alias: string | undefined) {
  if (isString(alias) && isEmpty(alias)) {
    throw new CliParameterError('wallet alias should not be empty if provided')
  }

  if (isString(alias) && containsWhite(alias)) {
    throw new CliParameterError('wallet alias should not contain white spaces, got: \'' + alias + '\'')
  }

  if (isString(alias) && !/^[a-zA-Z0-9_-]+$/.test(alias)) {
    throw new CliParameterError('wallet alias should only contain letters, numbers, underscores and hyphens')
  }
}

function checkMnemonic(mnemonic: string | undefined) {
  if (isString(mnemonic) && notIn(wordsSizeOf(mnemonic), [12, 15, 18, 21, 24])) {
    throw new CliParameterError('mnemonic should be a 12, 15, 18, 21 or 24 words long')
  }
}

function checkEntropy(entropy: string) {
  const validBits = [128, 160, 192, 224, 256]
  const bits = entropyBitLength(entropy)
  if (bits === undefined) {
    throw new CliParameterError('entropy should use hex (0x...) or binary (0b...) format')
  }
  if (!validBits.includes(bits)) {
    throw new CliParameterError('entropy should be one of ' + validBits.join(', ') + ' bits')
  }
}

function checkMnemonicLengthToGenerate(mnemonicLength: number | undefined) {
  if (isNumber(mnemonicLength) && notIn(mnemonicLength, [12, 15, 18, 21, 24])) {
    throw new CliParameterError('mnemonic length should be 12, 15, 18, 21 or 24')
  }
}

async function generateNextWalletName(): Promise<string> {
  const walletsData = await repos.wallet.getAllWallets()

  let nextNameSuffixIndex = 0
  let nextName = 'wallet_' + nextNameSuffixIndex
  while (walletsData.find(wallet => wallet.alias === nextName)) nextName = 'wallet_' + ++nextNameSuffixIndex;

  return nextName
}

function fix(opts: WalletCreateParams) {
  if (typeof opts.alias === 'string') {
    opts.alias = opts.alias.trim()
  }

  if (typeof opts.mnemonic === 'string') {
    opts.mnemonic = ensureSingleWhiteSpace(opts.mnemonic.trim())
  }

  if (typeof opts.entropy === 'string') {
    opts.entropy = opts.entropy.trim()
  }

  if (Array.isArray(opts.share)) {
    opts.share = opts.share.map(share => ensureSingleWhiteSpace(share.trim()))
  }
}

function resolveMnemonicWords(opts: WalletCreateParams): string {
  if (opts.fromSlip39) {
    return recoverMnemonicFromSlip39Shares(opts.share ?? [])
  }

  return opts.mnemonic ?? mnemonicUtil.generate(toEntropyBuffer(opts.entropy) as Buffer | undefined ?? opts.mnemonicLength as 12 | 15 | 18 | 21 | 24)
}

async function ensureSlip39Shares(opts: WalletCreateParams): Promise<void> {
  if (!opts.fromSlip39 || (opts.share?.length ?? 0) > 0) {
    return
  }

  opts.share = process.stdin.isTTY === false
    ? normalizeShares(await readSlip39SharesFromStdin())
    : await promptSlip39Shares()
}

async function promptSlip39Shares(): Promise<string[]> {
  const shares: string[] = []
  while (true) {
    const result = await prompts({
      type: 'password',
      name: 'value',
      message: `Enter SLIP-39 share ${shares.length + 1} (leave blank when done)`
    })

    if (typeof result.value !== 'string' || result.value.trim().length === 0) {
      return shares
    }
    shares.push(ensureSingleWhiteSpace(result.value.trim()))
  }
}

async function readSlip39SharesFromStdin(): Promise<string[]> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf-8').split(/\r?\n/)
}

function normalizeShares(shares: string[]): string[] {
  return shares
    .map(share => ensureSingleWhiteSpace(share.trim()))
    .filter(share => share.length > 0)
}

function entropyBitLength(entropy: string): number | undefined {
  if (/^0x[0-9a-f]+$/i.test(entropy)) {
    return (entropy.length - 2) * 4
  }

  if (/^0b[01]+$/i.test(entropy)) {
    return entropy.length - 2
  }

  return undefined
}
