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
# Create a wallet
bitcold wallet create --alias my-wallet

# Show wallet details
bitcold wallet show my-wallet --private --mnemonic

# Sign a transaction
bitcold tx sign --from my-wallet@default --to bc1q... \
  --amount 50000 --fee 1500 --utxo <txid:vout:value>
```
