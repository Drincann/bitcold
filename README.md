
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/Drincann/bitcold)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/banner-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/banner-light.svg">
  <img alt="bitcold" src="docs/banner-dark.svg" width="100%">
</picture>

A lightweight CLI for generating Bitcoin cold wallets, managing keys, and signing transactions offline.

> **Full documentation, command reference, and examples at [bitcold.dev](https://bitcold.dev)**

## Install

```
npm install -g bitcold
```

## Quick Start

```bash
# Create a wallet with alias 'wallet_0'
bitcold wallet create wallet_0

# Show BIP84 account info
bitcold wallet show wallet_0@account_0:0 --private --mnemonic

# Sign a transaction (ouputs a raw transaction QR code for air-gapped environments)
bitcold tx sign --from wallet_0@account_0:0 --to bc1q... \
  --amount 50000 --fee 1500 \
  --utxo <txid:vout:value> \
  --qr

# Display the address QR code to receive Bitcoin
bitcold wallet receive wallet_0@account_0:0
```

