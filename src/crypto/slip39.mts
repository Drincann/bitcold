import { createHmac, pbkdf2Sync, randomBytes } from 'crypto'
import * as bip39 from 'bip39'
import { SLIP39_WORDS } from './slip39-wordlist.mjs'

const RADIX_BITS = 10
const ID_LENGTH_BITS = 15
const CHECKSUM_LENGTH_WORDS = 3
const DIGEST_LENGTH_BYTES = 4
const MIN_STRENGTH_BITS = 128
const MAX_SHARE_COUNT = 16
const SECRET_INDEX = 255
const DIGEST_INDEX = 254
const ROUND_COUNT = 4
const BASE_ITERATION_COUNT = 10000
const ITERATION_EXPONENT = 1
const EXTENDABLE = true
const CUSTOMIZATION = EXTENDABLE ? Buffer.from('shamir_extendable') : Buffer.from('shamir')

interface RawShare {
  x: number
  data: Buffer
}

interface DecodedShare {
  identifier: number
  extendable: boolean
  iterationExponent: number
  groupIndex: number
  groupThreshold: number
  groupCount: number
  index: number
  memberThreshold: number
  value: Buffer
}

export function splitMnemonicToSlip39Shares(
  mnemonic: string,
  threshold: number,
  shareCount: number
): string[] {
  checkShareParams(threshold, shareCount)

  const masterSecret = Buffer.from(bip39.mnemonicToEntropy(mnemonic), 'hex')
  const identifier = randomIdentifier()
  const encryptedMasterSecret = encrypt(masterSecret, Buffer.alloc(0), identifier)
  const memberShares = splitSecret(threshold, shareCount, encryptedMasterSecret)

  return memberShares.map(share => encodeShare({
    identifier,
    extendable: EXTENDABLE,
    iterationExponent: ITERATION_EXPONENT,
    groupIndex: 0,
    groupThreshold: 1,
    groupCount: 1,
    index: share.x,
    memberThreshold: threshold,
    value: share.data
  }))
}

export function recoverMnemonicFromSlip39Shares(mnemonics: string[]): string {
  if (mnemonics.length === 0) {
    throw new Error('At least one SLIP-39 share is required')
  }

  const shares = mnemonics.map(decodeShare)
  const first = shares[0]
  if (first.groupThreshold !== 1 || first.groupCount !== 1 || first.groupIndex !== 0) {
    throw new Error('Only single-group SLIP-39 shares are supported')
  }

  for (const share of shares) {
    if (
      share.identifier !== first.identifier ||
      share.extendable !== first.extendable ||
      share.iterationExponent !== first.iterationExponent ||
      share.groupIndex !== first.groupIndex ||
      share.groupThreshold !== first.groupThreshold ||
      share.groupCount !== first.groupCount ||
      share.memberThreshold !== first.memberThreshold
    ) {
      throw new Error('SLIP-39 shares do not belong to the same backup')
    }
  }

  const unique = uniqueShares(shares)
  if (unique.length < first.memberThreshold) {
    throw new Error(`Not enough SLIP-39 shares: need ${first.memberThreshold}, got ${unique.length}`)
  }

  const encryptedMasterSecret = recoverSecret(
    first.memberThreshold,
    unique.slice(0, first.memberThreshold).map(share => ({ x: share.index, data: share.value }))
  )
  const entropy = decrypt(encryptedMasterSecret, Buffer.alloc(0), first.identifier, first.iterationExponent, first.extendable)
  return bip39.entropyToMnemonic(entropy.toString('hex'))
}

function checkShareParams(threshold: number, shareCount: number) {
  if (!Number.isInteger(threshold) || threshold < 1) {
    throw new Error('SLIP-39 threshold must be a positive integer')
  }
  if (!Number.isInteger(shareCount) || shareCount < 1) {
    throw new Error('SLIP-39 shares must be a positive integer')
  }
  if (threshold > shareCount) {
    throw new Error('SLIP-39 threshold must not exceed shares')
  }
  if (shareCount > MAX_SHARE_COUNT) {
    throw new Error(`SLIP-39 shares must not exceed ${MAX_SHARE_COUNT}`)
  }
  if (threshold === 1 && shareCount > 1) {
    throw new Error('SLIP-39 1-of-many backups are not supported; use 1-of-1')
  }
}

function encodeShare(share: DecodedShare): string {
  const idExp =
    (share.identifier << 5) +
    ((share.extendable ? 1 : 0) << 4) +
    share.iterationExponent
  const shareParams =
    (share.groupIndex << 16) +
    ((share.groupThreshold - 1) << 12) +
    ((share.groupCount - 1) << 8) +
    (share.index << 4) +
    (share.memberThreshold - 1)

  const valueWords = intToWordIndices(bufferToBigInt(share.value), bitsToWords(share.value.length * 8))
  const data = [
    ...intToWordIndices(BigInt(idExp), 2),
    ...intToWordIndices(BigInt(shareParams), 2),
    ...valueWords
  ]
  return [...data, ...createChecksum(data, customizationFor(share.extendable))]
    .map(index => SLIP39_WORDS[index])
    .join(' ')
}

function decodeShare(mnemonic: string): DecodedShare {
  const indices = mnemonic.trim().split(/\s+/).map(word => {
    const index = (SLIP39_WORDS as readonly string[]).indexOf(word)
    if (index === -1) throw new Error(`Invalid SLIP-39 word '${word}'`)
    return index
  })

  if (indices.length < 20) {
    throw new Error('Invalid SLIP-39 share length')
  }

  const idExp = Number(intFromWordIndices(indices.slice(0, 2)))
  const extendable = ((idExp >> 4) & 1) === 1
  if (!verifyChecksum(indices, customizationFor(extendable))) {
    throw new Error('Invalid SLIP-39 share checksum')
  }

  const paddingLen = (RADIX_BITS * (indices.length - 7)) % 16
  if (paddingLen > 8) {
    throw new Error('Invalid SLIP-39 share length')
  }

  const shareParams = Number(intFromWordIndices(indices.slice(2, 4)))
  const valueIndices = indices.slice(4, -CHECKSUM_LENGTH_WORDS)
  const valueByteCount = bitsToBytes(RADIX_BITS * valueIndices.length - paddingLen)
  const value = bigIntToBuffer(intFromWordIndices(valueIndices), valueByteCount)

  return {
    identifier: idExp >> 5,
    extendable,
    iterationExponent: idExp & 0x0f,
    groupIndex: (shareParams >> 16) & 0x0f,
    groupThreshold: ((shareParams >> 12) & 0x0f) + 1,
    groupCount: ((shareParams >> 8) & 0x0f) + 1,
    index: (shareParams >> 4) & 0x0f,
    memberThreshold: (shareParams & 0x0f) + 1,
    value
  }
}

function splitSecret(threshold: number, shareCount: number, secret: Buffer): RawShare[] {
  if (secret.length * 8 < MIN_STRENGTH_BITS || secret.length % 2 !== 0) {
    throw new Error('SLIP-39 master secret must be at least 128 bits and have even byte length')
  }
  if (threshold === 1) {
    return [{ x: 0, data: secret }]
  }

  const randomShares: RawShare[] = []
  for (let i = 0; i < threshold - 2; i++) {
    randomShares.push({ x: i, data: randomBytes(secret.length) })
  }

  const randomPart = randomBytes(secret.length - DIGEST_LENGTH_BYTES)
  const digest = createDigest(randomPart, secret)
  const baseShares = [
    ...randomShares,
    { x: DIGEST_INDEX, data: Buffer.concat([digest, randomPart]) },
    { x: SECRET_INDEX, data: secret }
  ]

  const shares = [...randomShares]
  for (let i = threshold - 2; i < shareCount; i++) {
    shares.push({ x: i, data: interpolate(baseShares, i) })
  }
  return shares
}

function recoverSecret(threshold: number, shares: RawShare[]): Buffer {
  if (threshold === 1) {
    return shares[0].data
  }

  const secret = interpolate(shares, SECRET_INDEX)
  const digestShare = interpolate(shares, DIGEST_INDEX)
  const digest = digestShare.subarray(0, DIGEST_LENGTH_BYTES)
  const randomPart = digestShare.subarray(DIGEST_LENGTH_BYTES)
  if (!digest.equals(createDigest(randomPart, secret))) {
    throw new Error('Invalid SLIP-39 share digest')
  }
  return secret
}

function interpolate(shares: RawShare[], x: number): Buffer {
  const xCoordinates = new Set(shares.map(share => share.x))
  if (xCoordinates.size !== shares.length) {
    throw new Error('SLIP-39 share indices must be unique')
  }
  const valueLength = shares[0].data.length
  if (shares.some(share => share.data.length !== valueLength)) {
    throw new Error('SLIP-39 share values must have the same length')
  }
  const direct = shares.find(share => share.x === x)
  if (direct) return direct.data

  const logProd = shares.reduce((sum, share) => sum + LOG_TABLE[share.x ^ x], 0)
  const result = Buffer.alloc(valueLength)
  for (const share of shares) {
    const denominator = shares.reduce((sum, other) => {
      return other === share ? sum : sum + LOG_TABLE[share.x ^ other.x]
    }, 0)
    const logBasisEval = (logProd - LOG_TABLE[share.x ^ x] - denominator) % 255
    const normalizedLogBasisEval = logBasisEval < 0 ? logBasisEval + 255 : logBasisEval
    for (let i = 0; i < valueLength; i++) {
      const shareValue = share.data[i]
      result[i] ^= shareValue === 0 ? 0 : EXP_TABLE[(LOG_TABLE[shareValue] + normalizedLogBasisEval) % 255]
    }
  }
  return result
}

function encrypt(masterSecret: Buffer, passphrase: Buffer, identifier: number): Buffer {
  if (masterSecret.length % 2 !== 0) {
    throw new Error('SLIP-39 master secret must have even byte length')
  }
  let left = masterSecret.subarray(0, masterSecret.length / 2)
  let right = masterSecret.subarray(masterSecret.length / 2)
  const salt = saltFor(identifier, EXTENDABLE)
  for (let i = 0; i < ROUND_COUNT; i++) {
    const f = roundFunction(i, passphrase, ITERATION_EXPONENT, salt, right)
    const nextLeft = right
    right = xor(left, f)
    left = nextLeft
  }
  return Buffer.concat([right, left])
}

function decrypt(encryptedMasterSecret: Buffer, passphrase: Buffer, identifier: number, iterationExponent: number, extendable: boolean): Buffer {
  if (encryptedMasterSecret.length % 2 !== 0) {
    throw new Error('SLIP-39 encrypted master secret must have even byte length')
  }
  let left = encryptedMasterSecret.subarray(0, encryptedMasterSecret.length / 2)
  let right = encryptedMasterSecret.subarray(encryptedMasterSecret.length / 2)
  const salt = saltFor(identifier, extendable)
  for (let i = ROUND_COUNT - 1; i >= 0; i--) {
    const f = roundFunction(i, passphrase, iterationExponent, salt, right)
    const nextLeft = right
    right = xor(left, f)
    left = nextLeft
  }
  return Buffer.concat([right, left])
}

function roundFunction(i: number, passphrase: Buffer, iterationExponent: number, salt: Buffer, right: Buffer): Buffer {
  return pbkdf2Sync(
    Buffer.concat([Buffer.from([i]), passphrase]),
    Buffer.concat([salt, right]),
    (BASE_ITERATION_COUNT << iterationExponent) / ROUND_COUNT,
    right.length,
    'sha256'
  )
}

function createDigest(randomPart: Buffer, secret: Buffer): Buffer {
  return createHmac('sha256', randomPart).update(secret).digest().subarray(0, DIGEST_LENGTH_BYTES)
}

function createChecksum(data: number[], customization: Buffer): number[] {
  const values = [...customization, ...data, 0, 0, 0]
  const polymod = rs1024Polymod(values) ^ 1
  return [20, 10, 0].map(shift => (polymod >> shift) & 1023)
}

function verifyChecksum(data: number[], customization: Buffer): boolean {
  return rs1024Polymod([...customization, ...data]) === 1
}

function rs1024Polymod(values: number[]): number {
  const gen = [0xE0E040, 0x1C1C080, 0x3838100, 0x7070200, 0xE0E0009, 0x1C0C2412, 0x38086C24, 0x3090FC48, 0x21B1F890, 0x3F3F120]
  let chk = 1
  for (const value of values) {
    const b = chk >> 20
    chk = ((chk & 0xfffff) << 10) ^ value
    for (let i = 0; i < 10; i++) {
      chk ^= ((b >> i) & 1) === 1 ? gen[i] : 0
    }
  }
  return chk
}

function uniqueShares(shares: DecodedShare[]): DecodedShare[] {
  const seen = new Set<number>()
  const unique: DecodedShare[] = []
  for (const share of shares) {
    if (!seen.has(share.index)) {
      seen.add(share.index)
      unique.push(share)
    }
  }
  return unique
}

function customizationFor(extendable: boolean): Buffer {
  return extendable ? Buffer.from('shamir_extendable') : Buffer.from('shamir')
}

function saltFor(identifier: number, extendable: boolean): Buffer {
  return extendable ? Buffer.alloc(0) : Buffer.concat([Buffer.from('shamir'), bigIntToBuffer(BigInt(identifier), bitsToBytes(ID_LENGTH_BITS))])
}

function xor(a: Buffer, b: Buffer): Buffer {
  return Buffer.from(a.map((value, i) => value ^ b[i]))
}

function randomIdentifier(): number {
  return randomBytes(bitsToBytes(ID_LENGTH_BITS)).readUInt16BE(0) & ((1 << ID_LENGTH_BITS) - 1)
}

function bitsToBytes(n: number): number {
  return Math.ceil(n / 8)
}

function bitsToWords(n: number): number {
  return Math.ceil(n / RADIX_BITS)
}

function intToWordIndices(value: bigint, length: number): number[] {
  const mask = (1n << BigInt(RADIX_BITS)) - 1n
  const indices: number[] = []
  for (let i = length - 1; i >= 0; i--) {
    indices.push(Number((value >> BigInt(i * RADIX_BITS)) & mask))
  }
  return indices
}

function intFromWordIndices(indices: number[]): bigint {
  return indices.reduce((value, index) => value * 1024n + BigInt(index), 0n)
}

function bufferToBigInt(buffer: Buffer): bigint {
  return BigInt('0x' + buffer.toString('hex'))
}

function bigIntToBuffer(value: bigint, byteLength: number): Buffer {
  if (value >> BigInt(byteLength * 8)) {
    throw new Error('Invalid SLIP-39 share padding')
  }
  const hex = value.toString(16).padStart(byteLength * 2, '0')
  return Buffer.from(hex, 'hex')
}

function precomputeExpLog(): [number[], number[]] {
  const exp = Array(255).fill(0)
  const log = Array(256).fill(0)
  let poly = 1
  for (let i = 0; i < 255; i++) {
    exp[i] = poly
    log[poly] = i
    poly = (poly << 1) ^ poly
    if (poly & 0x100) {
      poly ^= 0x11b
    }
  }
  return [exp, log]
}

const [EXP_TABLE, LOG_TABLE] = precomputeExpLog()
