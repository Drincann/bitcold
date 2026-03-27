import QRCode from 'qrcode'
import { Command } from 'commander'
import { printer } from '../../output/index.mjs'
import { ensureCliLevelSecretInitialized } from '../../../env/index.mjs'
import { CliError } from '../../../error/cli-error.mjs'
import { repositories as repos } from '../../../persistence/repository.mjs'
import { Wallet } from '../../../domain/wallet.mjs'
import { BtcAddress } from '../../../domain/address.mjs'
import { calcVSizeFromHex, createTransaction } from '../../../domain/transaction.mjs'
import { isAddressRef, isNotInt, isNotValidBtcAddressOrRef, isNotValidHex, isNotValidRef } from '../../../utils/validator.mjs'

interface TxSignParameters {
  from: string
  to: string

  amount: string
  fee: string

  utxo?: string[]

}

interface CheckedTxSignParameters {
  from: string
  to: string

  amount: number
  fee: number

  utxos: { hash: string, index: number, value: number }[]

}

export const txSignCommand = new Command()
  .name('sign')
  .description('Sign a transaction')

  .requiredOption('--from <address-ref>', 'Sender address reference(wallet-alias@address-alias)')
  .requiredOption('--to <address-or-address-ref>', 'Recipient address or address reference(wallet-alias@address-alias)')
  .requiredOption('--amount <sats>', 'sats to send')
  .requiredOption('--fee <fee>', 'fee(sats)')
  .requiredOption('--utxo <hash:index:value>', 'UTXO input, can be specified multiple times', (value: string, previous: string[]) => {
    const list = Array.isArray(previous) ? previous : []
    list.push(value)
    return list
  }, [] as string[])
  .option('--qr', 'Display signed transaction as QR code in terminal')
  .action(async (_: TxSignParameters, cmd) => {
    try {
      const opts = check(_)
      await ensureCliLevelSecretInitialized()

      const sender: BtcAddress = await resolveAddress(opts.from)
      const receiver: string = await resolveRawAddress(opts.to)

      const tx = createTransaction({
        from: sender,
        to: receiver,
        amount: opts.amount,
        fee: { sats: opts.fee },
        utxos: opts.utxos
      })

      const signedTx = sender.sign(tx)
      const vsize = calcVSizeFromHex(signedTx.hex())
      printer.info('Fee rate: ' + (opts.fee / vsize).toFixed(2) + ' sats/vbyte')
      printer.info('Signed transaction (' + vsize + ' vbytes):')
      printer.info('')
      printer.info(signedTx.hex())

      if (cmd.opts().qr) {
        const qr = await QRCode.toString(signedTx.hex(), { type: 'terminal', small: true })
        printer.info('\n' + qr)
      }

    } catch (e: unknown) {
      printer.error((e as any)?.message ?? 'unknown error')
    }
  })

async function resolveAddress(addressRef: string): Promise<BtcAddress> {
  return await Wallet.dereference(addressRef)
}

async function resolveRawAddress(addressOrRef: string): Promise<string> {
  if (isAddressRef(addressOrRef)) {
    return (await Wallet.dereference(addressOrRef)).address
  }

  return addressOrRef
}

function check(opts: TxSignParameters): CheckedTxSignParameters {
  if (isNotValidRef(opts.from)) {
    throw new CliError('Invalid BTC address \'' + opts.from + '\'')
  }
  if (isNotValidBtcAddressOrRef(opts.to)) {
    throw new CliError('Invalid BTC address \'' + opts.to + '\'')
  }

  if (isNotInt(opts.amount) || parseInt(opts.amount) <= 0) {
    throw new CliError('Invalid amount \'' + opts.amount + '\'')
  }
  if (isNotInt(opts.fee)) {
    throw new CliError('Invalid fee \'' + opts.fee + '\'')
  }

  const utxoArgs: string[] = Array.isArray(opts.utxo) ? opts.utxo : []
  if (utxoArgs.length === 0) {
    throw new CliError('At least one --utxo <hash:index:value> is required')
  }

  const utxos = utxoArgs.map(parseUtxo)

  const totalInput = utxos.reduce((acc, u) => acc + u.value, 0)
  if (parseInt(opts.fee) + parseInt(opts.amount) > totalInput) {
    throw new CliError('Invalid fee or amount, sum exceeds total input value of provided UTXOs')
  }

  return {
    from: opts.from,
    to: opts.to,
    amount: parseInt(opts.amount),
    fee: parseInt(opts.fee),
    utxos
  }
}

function parseUtxo(raw: string): { hash: string, index: number, value: number } {
  const parts = raw.split(':')
  if (parts.length !== 3) {
    throw new CliError('Invalid --utxo format, expected <hash:index:value>')
  }
  const [hash, indexStr, valueStr] = parts

  if (typeof hash !== 'string' || hash.length !== 64 || isNotValidHex(hash)) {
    throw new CliError('Invalid utxo hash \'' + hash + '\'')
  }
  if (isNotInt(indexStr)) {
    throw new CliError('Invalid utxo index \'' + indexStr + '\'')
  }
  if (isNotInt(valueStr)) {
    throw new CliError('Invalid utxo value \'' + valueStr + '\'')
  }

  return { hash, index: parseInt(indexStr), value: parseInt(valueStr) }
}
