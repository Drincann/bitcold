import crypto from 'crypto'

export class AesAuthenticationError extends Error {
  constructor() {
    super('Decryption failed: authentication tag mismatch')
    this.name = 'AesAuthenticationError'
  }
}

export type KdfParams = { name: 'scrypt'; N: number; r: number; p: number; keyLength: number }
export interface CipherParams {
  name: 'aes-256-gcm'
  keyLength: number
}

export interface EncryptedEnvelopeV1 {
  version: 1
  kdf: KdfParams
  cipher: CipherParams
  salt: string
  iv: string
  tag: string
  ciphertext: string
}

const DEFAULT_SCRYPT: KdfParams = { name: 'scrypt', N: 1 << 18, r: 8, p: 1, keyLength: 32 }
const DEFAULT_CIPHER: CipherParams = { name: 'aes-256-gcm', keyLength: 32 }

export async function aesEncrypt(content: string, passphrase: string): Promise<EncryptedEnvelopeV1> {
  const iv = crypto.randomBytes(12)
  const salt = crypto.randomBytes(16)
  const key = await deriveKey(passphrase, salt, DEFAULT_SCRYPT)

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(content, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return {
    version: 1,
    kdf: DEFAULT_SCRYPT,
    cipher: DEFAULT_CIPHER,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    tag: authTag.toString('hex'),
    ciphertext: encrypted.toString('hex'),
  }
}

export async function aesDecrypt(encrypted: unknown, passphrase: string): Promise<string> {
  if (!isEnvelopeV1(encrypted)) {
    throw new Error('Unsupported encrypted envelope format')
  }

  const iv = Buffer.from(encrypted.iv, 'hex')
  const salt = Buffer.from(encrypted.salt, 'hex')
  const key = await deriveKey(passphrase, salt, encrypted.kdf)
  const ciphertext = Buffer.from(encrypted.ciphertext, 'hex')
  const authTag = Buffer.from(encrypted.tag, 'hex')

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return decrypted.toString('utf8')
  } catch {
    throw new AesAuthenticationError()
  }
}

export async function deriveKey(password: string, salt: Buffer, kdf: KdfParams): Promise<Buffer> {
  const requiredMem = kdf.N * 128 * kdf.r
  const maxmem = Math.max(64 * 1024 * 1024, requiredMem * 2)
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, kdf.keyLength, { N: kdf.N, r: kdf.r, p: kdf.p, maxmem }, (err, derivedKey) => {
      if (err) return reject(err)
      resolve(derivedKey as Buffer)
    })
  })
}

export function isEnvelopeV1(v: unknown): v is EncryptedEnvelopeV1 {
  if (typeof v !== 'object' || v === null) return false;
  const obj = v as Record<string, unknown>;
  return obj.version === 1 && typeof obj.kdf === 'object' && typeof obj.cipher === 'object'
    && 'ciphertext' in obj && 'salt' in obj && 'iv' in obj && 'tag' in obj;
}