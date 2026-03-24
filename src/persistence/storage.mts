import fs from 'fs/promises'
import path from 'path'
import { printer } from '../cli/output/index.mjs'
import { aesDecrypt, aesEncrypt } from '../crypto/aes.mjs'
import { CliInternalError } from '../error/cli-error.mjs'

export interface Storage<
  DataTypes extends { [key in Keys]: any },
  Keys extends string = Exclude<keyof DataTypes, symbol | number>
> {
  save<K extends Keys>(key: K, data: DataTypes[K]): Promise<void>
  load<K extends Keys>(key: K): Promise<DataTypes[K]>
}

export class EncryptedUserHomeJsonStorage<
  DataTypes extends { [key in Keys]: any },
  Keys extends string = Exclude<keyof DataTypes, symbol | number>
> implements Storage<DataTypes, Keys> {
  private cache?: DataTypes
  private passphrase: string

  constructor(passphrase: string) {
    this.passphrase = passphrase
  }

  private async loadAllAndDecrypt(): Promise<DataTypes> {
    const storageRoot = getStorageRoot()
    await createIfNotExists(storageRoot)
    const data = {} as DataTypes

    await this.walk(storageRoot, async file => {
      const key = path.basename(file, '.json')
      try {
        const raw = JSON.parse((await fs.readFile(file, 'utf-8')))
        if (isCrypted(raw)) {
          if (!this.passphrase) {
            throw new CliInternalError('Passphrase is required')
          }

          const decrypted = await aesDecrypt(raw, this.passphrase)
          const content = JSON.parse(decrypted)
          data[key as Keys] = content
          return;
        }

        data[key as Keys] = raw
      } catch (err) {
        printer.debug(`Storage: class EncryptedUserHomeJsonStorage: Error loading data for key ${key}: ${(err as any)?.message ?? 'unknown error'}`)
        throw new CliInternalError(`Error loading data for key: ${key}`, err)
      }
    })

    return data
  }

  private async walk(dir: string, callback: (file: string) => Promise<void>) {
    const files = await fs.readdir(dir)

    for (const file of files) {
      const filePath = path.join(dir, file)
      const stat = await fs.stat(filePath)

      if (stat.isFile()) {
        await callback(filePath)
      } else {
        printer.debug(`Storage: method walk: Skipping directory ${filePath}`)
      }
    }
  }

  public async save<K extends Keys>(key: K, data: DataTypes[K]): Promise<void> {
    if (!this.cache) {
      this.cache = await this.loadAllAndDecrypt()
    }

    this.cache[key] = data
    const storageRoot = getStorageRoot()
    await createIfNotExists(storageRoot)
    const file = path.join(storageRoot, `${key}.json`)
    if (!this.passphrase) {
      throw new CliInternalError('Passphrase is required')
    }

    fs.writeFile(file, JSON.stringify(await aesEncrypt(JSON.stringify(data), this.passphrase)))
  }

  public async load<K extends Keys>(key: K): Promise<DataTypes[K]> {
    if (!this.cache) {
      this.cache = await this.loadAllAndDecrypt()
    }

    return this.cache[key]
  }
}

export class UserHomeJsonStorage<
  DataTypes extends { [key in Keys]: any },
  Keys extends string = Exclude<keyof DataTypes, symbol | number>
> implements Storage<DataTypes, Keys> {
  private cache?: DataTypes

  constructor() { }

  private async loadAllAndDecrypt(): Promise<DataTypes> {
    const storageRoot = getStorageRoot()
    await createIfNotExists(storageRoot)
    const data = {} as DataTypes

    await this.walk(storageRoot, async file => {
      const key = path.basename(file, '.json')
      try {
        data[key as Keys] = JSON.parse((await fs.readFile(file, 'utf-8')))
      } catch (err) {
        printer.debug(`Storage: class UserHomeJsonStorage: Error loading data for key ${key}`)
        throw new CliInternalError(`Error loading data for key: ${key}`, err)
      }
    })

    return data
  }

  private async walk(dir: string, callback: (file: string) => Promise<void>) {
    const files = await fs.readdir(dir)

    for (const file of files) {
      const filePath = path.join(dir, file)
      const stat = await fs.stat(filePath)

      if (stat.isFile()) {
        await callback(filePath)
      } else {
        printer.warn(`Storage: method walk: Skipping directory ${filePath}`)
      }
    }
  }

  public async save<K extends Keys>(key: K, data: DataTypes[K]): Promise<void> {
    if (!this.cache) {
      this.cache = await this.loadAllAndDecrypt()
    }

    this.cache[key] = data
    const storageRoot = getStorageRoot()
    await createIfNotExists(storageRoot)
    const file = path.join(storageRoot, `${key}.json`)

    fs.writeFile(file, JSON.stringify(data))
  }

  public async load<K extends Keys>(key: K): Promise<DataTypes[K]> {
    if (!this.cache) {
      this.cache = await this.loadAllAndDecrypt()
    }

    return this.cache[key]
  }
}

export const getStorageRoot = () => {
  return path.resolve(getUserHome(), '.bitcold')
}

const createIfNotExists = async (dir: string) => {
  try {
    await fs.mkdir(dir)
  } catch (err) {
    if ((err as any)?.code !== 'EEXIST') {
      throw new CliInternalError(`Error creating directory: ${dir}`, err)
    }
  }

  return dir
}

const getUserHome = () => {
  if (process.env.HOME) {
    printer.debug('Storage: method getUserHome: Using HOME')
    return process.env.HOME
  }

  if (process.env.USERPROFILE) {
    printer.debug('Storage: method getUserHome: Using USERPROFILE')
    return process.env.USERPROFILE
  }

  throw new CliInternalError('Could not find home directory from environment variables')
}

function isCrypted(content: unknown): boolean {
  if (content === undefined || content === null) {
    return false
  }
  return typeof content === 'object' && 'ciphertext' in content
}
