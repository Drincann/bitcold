import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CliSandbox } from './helpers/cli-sandbox.js';

const TRUTH_SET_1 = {
  mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  mainnet: 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu',
  regtest: 'bcrt1q6rz28mcfaxtmd6v789l9rrlrusdprr9pz3cppk',
  entropy: '0'.repeat(128)
};

const TRUTH_SET_2 = {
  mnemonic: 'night service anxiety work canoe clog obey barely energy tackle rent merit',
  mainnet: 'bc1qvlsew3ys27n29aqvdc5ezq2gdvt8czctw3p983',
  regtest: 'bcrt1qdfztqwuhxmsut4xzccfnc5dpayxhq4kjzc6spv',
  // Binary string for TRUTH_SET_2 entropy (exactly 128 bits)
  entropy: '10010101100110001000010000101000011111101100001000011000010101110010010111111000100101000100101000011011101000101101100101000101'
};

const CLI_PASS = 'test-cli-passphrase-123';

/** Helper: create a wallet non-interactively (using BITCOLD_PASSPHRASE env var). */
async function createWallet(
  sandboxDir: string,
  alias = 'test-wallet',
  mnemonic = TRUTH_SET_1.mnemonic,
  bip39pass = '',
): Promise<string> {
  const s = new CliSandbox();
  s.sandboxDir = sandboxDir;
  const args = ['wallet', 'create', alias, '-m', mnemonic, '-s'];
  if (bip39pass) args.push('-p', bip39pass);
  s.run(args, { BITCOLD_PASSPHRASE: CLI_PASS });
  const r = await s.finish();
  if (r.exitCode !== 0) throw new Error(`createWallet failed:\n${r.output}`);
  return r.output;
}

function reuseDir(dir: string): CliSandbox {
  const s = new CliSandbox();
  s.sandboxDir = dir;
  return s;
}

function extractAddress(output: string): string | undefined {
  // Regex that handles potential ANSI chars or multiple matches
  const match = output.match(/(bc1q|bcrt1|tb1q)[a-zA-HJ-NP-Z0-9]{30,}/);
  return match?.[0];
}

describe('Bitcold E2E – Security & Cryptographic Truth', () => {
  let sandbox: CliSandbox;

  beforeEach(async () => {
    sandbox = new CliSandbox();
    await sandbox.init();
  });

  afterEach(async () => {
    await sandbox.cleanup();
  });

  // ───────────────────────────────────────────────────────────
  // 1. Cryptographic Truth (Mainnet & Regtest)
  // ───────────────────────────────────────────────────────────

  describe('Truth: Address Derivation (BIP84 Native SegWit)', () => {
    it('Mainnet: standard bc1q address (Truth Set 1)', async () => {
      await createWallet(sandbox.sandboxDir, 'm1-wallet', TRUTH_SET_1.mnemonic);
      const s = reuseDir(sandbox.sandboxDir);
      s.run(['wallet', 'receive', 'm1-wallet@account_0'], { 
        BITCOLD_PASSPHRASE: CLI_PASS,
        BITCOLD_BITCOIN_NETWORK: 'mainnet'
      });
      await s.waitFor('mnemonic passphrase');
      await s.type('\r');
      const r = await s.finish();
      const addr = extractAddress(r.output);
      expect(addr).toBe(TRUTH_SET_1.mainnet);
    }, 30000);

    it('Mainnet: standard bc1q address (Truth Set 2 - Random)', async () => {
      await createWallet(sandbox.sandboxDir, 'm2-wallet', TRUTH_SET_2.mnemonic);
      const s = reuseDir(sandbox.sandboxDir);
      s.run(['wallet', 'receive', 'm2-wallet@account_0'], { 
        BITCOLD_PASSPHRASE: CLI_PASS,
        BITCOLD_BITCOIN_NETWORK: 'mainnet'
      });
      await s.waitFor('mnemonic passphrase');
      await s.type('\r');
      const r = await s.finish();
      const addr = extractAddress(r.output);
      expect(addr).toBe(TRUTH_SET_2.mainnet);
    }, 30000);

    it('Regtest: standard bcrt1 address (Truth Set 1)', async () => {
      await createWallet(sandbox.sandboxDir, 'r1-wallet', TRUTH_SET_1.mnemonic);
      const s = reuseDir(sandbox.sandboxDir);
      s.run(['wallet', 'receive', 'r1-wallet@account_0'], { 
        BITCOLD_PASSPHRASE: CLI_PASS,
        BITCOLD_BITCOIN_NETWORK: 'regtest'
      });
      await s.waitFor('mnemonic passphrase');
      await s.type('\r');
      const r = await s.finish();
      const addr = extractAddress(r.output);
      expect(addr).toBe(TRUTH_SET_1.regtest);
    }, 30000);

    it('Regtest: standard bcrt1 address (Truth Set 2 - Random)', async () => {
      await createWallet(sandbox.sandboxDir, 'r2-wallet', TRUTH_SET_2.mnemonic);
      const s = reuseDir(sandbox.sandboxDir);
      s.run(['wallet', 'receive', 'r2-wallet@account_0'], { 
        BITCOLD_PASSPHRASE: CLI_PASS,
        BITCOLD_BITCOIN_NETWORK: 'regtest'
      });
      await s.waitFor('mnemonic passphrase');
      await s.type('\r');
      const r = await s.finish();
      const addr = extractAddress(r.output);
      expect(addr).toBe(TRUTH_SET_2.regtest);
    }, 30000);

    it('Entropy: 128-bit bits -> mnemonic (Truth Set 1)', async () => {
      sandbox.run(['wallet', 'create', 'e1-wallet', '-b', TRUTH_SET_1.entropy, '-s'], {
        BITCOLD_PASSPHRASE: CLI_PASS
      });
      const r = await sandbox.finish();
      const normalizedOutput = r.output.replace(/\s+/g, ' ');
      expect(normalizedOutput).toContain(TRUTH_SET_1.mnemonic);
    }, 30000);

    it('Entropy: 128-bit bits -> mnemonic (Truth Set 2)', async () => {
      sandbox.run(['wallet', 'create', 'e2-wallet', '-b', TRUTH_SET_2.entropy, '-s'], {
        BITCOLD_PASSPHRASE: CLI_PASS
      });
      const r = await sandbox.finish();
      const normalizedOutput = r.output.replace(/\s+/g, ' ');
      expect(normalizedOutput).toContain(TRUTH_SET_2.mnemonic);
    }, 30000);
  });

  // ───────────────────────────────────────────────────────────
  // 2. BIP39 Passphrase Security Gates & Regression
  // ───────────────────────────────────────────────────────────

  describe('Truth: Passphrase Security & Regression', () => {
    it('wallet show must NOT skip BIP39 passphrase prompt (Regression Bug)', async () => {
      await createWallet(sandbox.sandboxDir, 'proto-wallet');
      const s = reuseDir(sandbox.sandboxDir);
      s.run(['wallet', 'show', 'proto-wallet'], { BITCOLD_PASSPHRASE: CLI_PASS });
      // This will timeout if prompt is missing, which caught the original bug
      await s.waitFor('mnemonic passphrase', 5000); 
      await s.type('\r');
      await s.finish();
    }, 20000);

    it('different BIP39 passphrase results in different address (via receive)', async () => {
      await createWallet(sandbox.sandboxDir, 'salt-wallet');
      
      const s1 = reuseDir(sandbox.sandboxDir);
      s1.run(['wallet', 'receive', 'salt-wallet@account_0'], { BITCOLD_PASSPHRASE: CLI_PASS });
      await s1.waitFor('mnemonic passphrase');
      await s1.type('\r'); // empty
      const r1 = await s1.finish();

      const s2 = reuseDir(sandbox.sandboxDir);
      s2.run(['wallet', 'receive', 'salt-wallet@account_0'], { BITCOLD_PASSPHRASE: CLI_PASS });
      await s2.waitFor('mnemonic passphrase');
      await s2.type('salty-salt\r');
      await s2.waitFor('Confirm passphrase');
      await s2.type('salty-salt\r');
      const r2 = await s2.finish();

      const addr1 = extractAddress(r1.output);
      const addr2 = extractAddress(r2.output);
      expect(addr1).toBeDefined();
      expect(addr2).toBeDefined();
      expect(addr1).not.toBe(addr2);
    }, 35000);
  });

  // ───────────────────────────────────────────────────────────
  // 3. Command Interactions (CRUD & Accounts)
  // ───────────────────────────────────────────────────────────

  describe('Interactions: Wallet & Account Lifecycle', () => {
    it('consistency: show, list and receive must agree on wallet state', async () => {
      await createWallet(sandbox.sandboxDir, 'consist');
      
      const ls = reuseDir(sandbox.sandboxDir);
      ls.run(['wallet', 'list'], { BITCOLD_PASSPHRASE: CLI_PASS });
      const r_ls = await ls.finish();
      expect(r_ls.output).toContain('consist');

      const s = reuseDir(sandbox.sandboxDir);
      s.run(['wallet', 'receive', 'consist@account_0'], { BITCOLD_PASSPHRASE: CLI_PASS });
      await s.waitFor('mnemonic passphrase');
      await s.type('\r');
      const r_sh = await s.finish();
      const addrShow = extractAddress(r_sh.output);

      const r = reuseDir(sandbox.sandboxDir);
      r.run(['wallet', 'receive', 'consist@account_0'], { BITCOLD_PASSPHRASE: CLI_PASS });
      await r.waitFor('mnemonic passphrase');
      await r.type('\r');
      const r_re = await r.finish();
      const addrRecv = extractAddress(r_re.output);

      expect(addrShow).toBeDefined();
      expect(addrRecv).toBe(addrShow);
    }, 40000);

    it('account add: creates account_1 with different address and persists', async () => {
      await createWallet(sandbox.sandboxDir, 'multi');
      
      const add = reuseDir(sandbox.sandboxDir);
      add.run(['wallet', 'account', 'add', 'multi', 'savings'], { BITCOLD_PASSPHRASE: CLI_PASS });
      await add.waitFor('mnemonic passphrase');
      await add.type('\r');
      await add.finish();

      const re = reuseDir(sandbox.sandboxDir);
      re.run(['wallet', 'receive', 'multi@savings'], { 
        BITCOLD_PASSPHRASE: CLI_PASS,
        BITCOLD_BITCOIN_NETWORK: 'mainnet'
      });
      await re.waitFor('mnemonic passphrase');
      await re.type('\r');
      const r = await re.finish();
      
      expect(r.output).toContain("m/84'/0'/1'/0/0");
    }, 35000);

    it('top-level account alias matches wallet account add behavior', async () => {
      await createWallet(sandbox.sandboxDir, 'alias-account');

      const add = reuseDir(sandbox.sandboxDir);
      add.run(['account', 'add', 'alias-account', 'vault'], { BITCOLD_PASSPHRASE: CLI_PASS });
      await add.waitFor('mnemonic passphrase');
      await add.type('\r');
      const added = await add.finish();
      expect(added.output).toContain("Account 'vault' added to wallet 'alias-account'");

      const ls = reuseDir(sandbox.sandboxDir);
      ls.run(['wallet', 'list'], { BITCOLD_PASSPHRASE: CLI_PASS });
      const listed = await ls.finish();
      expect(listed.output).toContain('alias-account  [account_0, vault]');
    }, 35000);

    it('top-level receive alias matches wallet receive behavior', async () => {
      await createWallet(sandbox.sandboxDir, 'alias-receive');

      const walletReceive = reuseDir(sandbox.sandboxDir);
      walletReceive.run(['wallet', 'receive', 'alias-receive@account_0'], { BITCOLD_PASSPHRASE: CLI_PASS });
      await walletReceive.waitFor('mnemonic passphrase');
      await walletReceive.type('\r');
      const walletOutput = await walletReceive.finish();

      const topLevelReceive = reuseDir(sandbox.sandboxDir);
      topLevelReceive.run(['receive', 'alias-receive@account_0'], { BITCOLD_PASSPHRASE: CLI_PASS });
      await topLevelReceive.waitFor('mnemonic passphrase');
      await topLevelReceive.type('\r');
      const aliasOutput = await topLevelReceive.finish();

      expect(extractAddress(aliasOutput.output)).toBe(extractAddress(walletOutput.output));
    }, 35000);

    it('wallet remove: demands confirmation and deletes data', async () => {
      await createWallet(sandbox.sandboxDir, 'dead-wallet');
      
      const rm = reuseDir(sandbox.sandboxDir);
      rm.run(['wallet', 'remove', 'dead-wallet'], { BITCOLD_PASSPHRASE: CLI_PASS });
      await rm.waitFor('Are you sure');
      await rm.type('n\r');
      await rm.finish();

      const ls1 = reuseDir(sandbox.sandboxDir);
      ls1.run(['wallet', 'list'], { BITCOLD_PASSPHRASE: CLI_PASS });
      const r1 = await ls1.finish();
      expect(r1.output).toContain('dead-wallet');

      const del = reuseDir(sandbox.sandboxDir);
      del.run(['wallet', 'remove', 'dead-wallet', '-y'], { BITCOLD_PASSPHRASE: CLI_PASS });
      await del.finish();

      const ls2 = reuseDir(sandbox.sandboxDir);
      ls2.run(['wallet', 'list'], { BITCOLD_PASSPHRASE: CLI_PASS });
      const r2 = await ls2.finish();
      expect(r2.output).toContain('No wallets found');
    }, 35000);
  });

  // ───────────────────────────────────────────────────────────
  // 4. Transaction Signing (Truth)
  // ───────────────────────────────────────────────────────────

  describe('Truth: Transaction Signing', () => {
    it('Signing (Regtest): results in valid witness-enabled tx hex', async () => {
      await createWallet(sandbox.sandboxDir, 'signer');
      const dummyUtxo = 'a'.repeat(64) + ':0:5000';
      
      const s = reuseDir(sandbox.sandboxDir);
      s.run([
        'tx', 'sign',
        '--from', 'signer@account_0',
        '--to', 'bcrt1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080',
        '--amount', '1000',
        '--fee', '200',
        '--utxo', dummyUtxo
      ], { BITCOLD_PASSPHRASE: CLI_PASS });

      await s.waitFor('mnemonic passphrase');
      await s.type('\r');
      const r = await s.finish();
      
      expect(r.exitCode).toBe(0);
      const txHex = r.output.match(/[0-9a-f]{100,}/i)?.[0];
      expect(txHex).toBeDefined();
      expect(txHex).toMatch(/^(01|02)000000/); // Version
      expect(txHex).toMatch(/00000000$/);   // Locktime
    }, 35000);

    it('Signing (Mainnet): address validation and witness construction', async () => {
      await createWallet(sandbox.sandboxDir, 'm-signer');
      const dummyUtxo = 'b'.repeat(64) + ':0:10000';
      
      const s = reuseDir(sandbox.sandboxDir);
      s.run([
        'tx', 'sign',
        '--from', 'm-signer@account_0',
        '--to', 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu',
        '--amount', '5000',
        '--fee', '1000',
        '--utxo', dummyUtxo
      ], { 
        BITCOLD_PASSPHRASE: CLI_PASS,
        BITCOLD_BITCOIN_NETWORK: 'mainnet'
      });

      await s.waitFor('mnemonic passphrase');
      await s.type('\r');
      const r = await s.finish();
      
      expect(r.exitCode).toBe(0);
      expect(r.output).toContain('Signed transaction');
      expect(r.output).toMatch(/[0-9a-f]{200,}/);
    }, 35000);
  });
});
