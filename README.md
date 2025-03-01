# MinaTokens API example

The **MinaTokens API** provides a simple and efficient way to interact with custom tokens on the Mina blockchain. This API allows developers to deploy tokens, mint tokens, transfer tokens, and retrieve token information with ease.

## Table of Contents

- [Introduction](#introduction)
- [REST API](#rest-api)
- [Installation](#installation)
- [Getting Started](#getting-started)
  - [Initializing the API](#initializing-the-api)
  - [Deploying a Token](#deploying-a-token)
  - [Minting Tokens](#minting-tokens)
  - [Transferring Tokens](#transferring-tokens)
  - [Getting Token Information](#getting-token-information)
- [API Reference](#api-reference)
- [Project Description](#project-description)
- [Resources](#resources)

## Introduction

The MinaTokens API is part of the **MINA Custom Token Launchpad on zkCloudWorker** project. This launchpad aims to simplify the process of creating and managing custom tokens on the Mina blockchain, making it accessible to both technical and non-technical users.

## REST API

The MinaTokens API provides the following REST endpoints:

### Fungible Token Endpoints

- **Get Token Info** `POST /info`
  - Retrieves detailed information about a Mina Fungible Token
  - Requires API key in `x-api-key` header
  - Request body: `{ tokenAddress: string }`

### NFT Endpoints

- **Get NFT Info** `POST /nft`
  - Retrieves detailed information about a MinaNFT
  - Requires API key in `x-api-key` header
  - Request body: `{ contractAddress: string, nftAddress: string }`

### Transaction Endpoints

- **Build Deploy Token Transaction** `POST /deploy`

  - Builds a deploy token transaction for a new token
  - Requires API key in `x-api-key` header
  - Request body: `{ adminAddress: string, symbol: string, decimals: number, uri: string }`

- **Build Token Transaction** `POST /transaction`

  - Builds a token transaction (transfer or mint)
  - Requires API key in `x-api-key` header
  - Request body includes transaction type, sender, token details, and amount

- **Prove Token Transaction** `POST /prove`

  - Proves a token transaction and optionally sends it to the network
  - Requires API key in `x-api-key` header
  - Request body includes signed transaction data

- **Get Proving Job Result** `POST /result`

  - Retrieves the result of a proving job
  - Requires API key in `x-api-key` header
  - Request body: `{ jobId: string }`

- **Request Funds from Faucet** `POST /faucet`

  - Requests funds from the faucet for testing purposes
  - Requires API key in `x-api-key` header
  - Request body: `{ address: string }`

- **Get Transaction Status** `POST /tx-status`
  - Retrieves the status of a transaction by hash
  - Requires API key in `x-api-key` header
  - Request body: `{ hash: string }`

The API is available at:

- Devnet: `https://devnet.minatokens.com/api/v1/`
- Zeko: `https://zekotokens.com/api/v1/`
- Mainnet: `https://minatokens.com/api/v1/`

### API Reference

For detailed API documentation, refer to the [MinaTokens API Documentation](https://docs.zkcloudworker.com/minatokens-api) or try it at https://zkcloudworker.readme.io

### API Key

To get an API key, contact support@zkcloudworker.com.

## Installation

To use the MinaTokens API example, install it:

```sh
git clone https://github.com/zkcloudworker/tokens-api-example
yarn
```

## Getting Started

### Initializing the API

First, import the `MinaTokensAPI` class and initialize it with your API key and desired chain environment.

```typescript
import { MinaTokensAPI } from "./api";

const api = new MinaTokensAPI({
  apiKey: "YOUR_API_KEY",
  chain: "devnet", // Options: "mainnet", "devnet", "zeko", "local"
});
```

### Deploying a Token

Deploying a new token involves building a deploy transaction, signing it, and then proving and sending the transaction.

```typescript
// Build the deploy token transaction
const deployTx = await api.buildDeployTokenTransaction({
  adminAddress: admin.publicKey,
  symbol: "TEST",
  decimals: 9,
  uri: "https://minatokens.com",
});

// Sign the transaction
const signBody = {
  zkappCommand: JSON.parse(deployTx.payload.transaction),
  feePayer: {
    feePayer: admin.publicKey,
    fee: deployTx.payload.feePayer.fee,
    nonce: deployTx.payload.nonce,
    memo: deployTx.payload.feePayer.memo,
  },
};

const signedResult = client.signTransaction(signBody, admin.privateKey);
const signedData = JSON.stringify(signedResult.data);

// Prove and send the transaction
const proveTx = await api.proveTokenTransaction({
  txType: "deploy",
  serializedTransaction: deployTx.serializedTransaction,
  signedData,
  senderAddress: admin.publicKey,
  tokenAddress: deployTx.tokenAddress,
  adminContractAddress: deployTx.adminContractAddress,
  symbol: "TEST",
  uri: "https://minatokens.com",
  sendTransaction: true,
});

// Wait for the transaction to be included in a block
const hash = await api.waitForJobResult(proveTx.jobId);
await api.waitForTransaction(hash);

// Get token info
const tokenInfo = await api.getTokenInfo(deployTx.tokenAddress);
console.log("Token deployed:", tokenInfo);
```

### Minting Tokens

Once your token is deployed, you can mint new tokens to a specified address.

```typescript
// Build the mint transaction
const mintTx = await api.tokenTransaction({
  txType: "mint",
  symbol: "TEST",
  senderAddress: admin.publicKey,
  tokenAddress: deployTx.tokenAddress,
  adminContractAddress: deployTx.adminContractAddress,
  to: recipient.publicKey,
  amount: 100_000_000_000, // Amount in smallest units
});

// Sign the transaction
const signBody = {
  zkappCommand: JSON.parse(mintTx.payload.transaction),
  feePayer: {
    feePayer: admin.publicKey,
    fee: mintTx.payload.feePayer.fee,
    nonce: mintTx.payload.nonce,
    memo: mintTx.payload.feePayer.memo,
  },
};

const signedResult = client.signTransaction(signBody, admin.privateKey);
const signedData = JSON.stringify(signedResult.data);

// Prove and send the transaction
const proveTx = await api.proveTokenTransaction({
  txType: "mint",
  serializedTransaction: mintTx.serializedTransaction,
  signedData,
  senderAddress: admin.publicKey,
  tokenAddress: deployTx.tokenAddress,
  adminContractAddress: deployTx.adminContractAddress,
  symbol: "TEST",
  to: recipient.publicKey,
  amount: 100_000_000_000,
  sendTransaction: true,
});

// Wait for the transaction to be included in a block
const hash = await api.waitForJobResult(proveTx.jobId);
await api.waitForTransaction(hash);

// Get updated token info
const tokenInfo = await api.getTokenInfo(deployTx.tokenAddress);
console.log("Tokens minted:", tokenInfo);
```

### Transferring Tokens

Transfer tokens from one address to another.

```typescript
// Build the transfer transaction
const transferTx = await api.tokenTransaction({
  txType: "transfer",
  symbol: "TEST",
  senderAddress: sender.publicKey,
  tokenAddress: deployTx.tokenAddress,
  adminContractAddress: deployTx.adminContractAddress,
  to: recipient.publicKey,
  amount: 50_000_000_000,
});

// Sign the transaction
const signBody = {
  zkappCommand: JSON.parse(transferTx.payload.transaction),
  feePayer: {
    feePayer: sender.publicKey,
    fee: transferTx.payload.feePayer.fee,
    nonce: transferTx.payload.nonce,
    memo: transferTx.payload.feePayer.memo,
  },
};

const signedResult = client.signTransaction(signBody, sender.privateKey);
const signedData = JSON.stringify(signedResult.data);

// Prove and send the transaction
const proveTx = await api.proveTokenTransaction({
  txType: "transfer",
  serializedTransaction: transferTx.serializedTransaction,
  signedData,
  senderAddress: sender.publicKey,
  tokenAddress: deployTx.tokenAddress,
  adminContractAddress: deployTx.adminContractAddress,
  symbol: "TEST",
  to: recipient.publicKey,
  amount: 50_000_000_000,
  sendTransaction: true,
});

// Wait for the transaction to be included in a block
const hash = await api.waitForJobResult(proveTx.jobId);
await api.waitForTransaction(hash);

// Get updated token info
const tokenInfo = await api.getTokenInfo(deployTx.tokenAddress);
console.log("Tokens transferred:", tokenInfo);
```

### Getting Token Information

Retrieve information about your deployed token.

```typescript
const tokenInfo = await api.getTokenInfo(deployTx.tokenAddress);
console.log("Token Information:", tokenInfo);
```

### MinaTokensAPI Class

```typescript:src/api.ts
export class MinaTokensAPI {
  readonly chain: "mainnet" | "devnet" | "zeko" | "local";
  readonly apiKey: string;

  constructor(params: {
    apiKey: string;
    chain?: "mainnet" | "devnet" | "zeko" | "local";
  }) {
    const { chain, apiKey } = params;
    this.chain = chain ?? "devnet";
    this.apiKey = apiKey;
  }

  // ... Other methods
}
```

### Methods

- `buildDeployTokenTransaction`
- `proveTokenTransaction`
- `tokenTransaction`
- `getTokenInfo`
- `waitForJobResult`
- `waitForTransaction`
- `txStatus`
- `faucet`
- `getNFTInfo`
- `proveJobResult`

## Project Description

The **MINA Custom Token Launchpad on zkCloudWorker** is designed to simplify the process of creating and managing custom tokens on the Mina blockchain. It provides:

- **No-Code Token Launchpad**: Enables non-technical users to deploy and manage custom tokens without writing code.
- **Developer API**: Offers a comprehensive API for developers to integrate custom token functionalities into their applications.
- **Token Management Tools**: Includes features for minting, transferring, and airdropping tokens.

## Resources

- **API Documentation**: [https://docs.zkcloudworker.com/minatokens-api](https://docs.zkcloudworker.com/minatokens-api)
- **GitHub Repository**: [zkCloudWorker/tokens-api-example](https://github.com/zkcloudworker/tokens-api-example)
- **Mina Tokens Launchpad**: [https://minatokens.com](https://minatokens.com)
- **zkCloudWorker**: [https://zkcloudworker.com](https://zkcloudworker.com)

---

**Note**: This project utilizes the Mina blockchain's custom token standard [FungibleToken](https://github.com/MinaFoundation/mina-fungible-token) and leverages zkCloudWorker for cloud-based proving and transaction management.

### Run tests on Devnet

```sh
yarn test
```

## Logs

```
tokens-api-example % yarn test
[5:47:08 PM] Getting existing transaction status...
[5:47:12 PM]  [
  {
    hash: '5JuEaWqCkiizzjA3mjrva5hjYeohiGKQFcffUdZxrEJM4xDirhK1',
    status: 'applied',
    details: {
      blockHeight: 366045,
      stateHash: '3NKsAd6i1K7BDu3qzYhkkotXghJK8y5ckyT2h697yEGpdJ1bmfNo',
      blockStatus: 'canonical',
      timestamp: 1731374460000,
      txHash: '5JuEaWqCkiizzjA3mjrva5hjYeohiGKQFcffUdZxrEJM4xDirhK1',
      txStatus: 'applied',
      failures: [],
      memo: 'mint 100 TEST',
      feePayerAddress: 'B62qjFmTAzmLvPXRhUn8H83BoqtQxFtqHe8DkYBrj44TP6uKWWNfa1a',
      feePayerName: null,
      feePayerImg: null,
      fee: 0.1,
      feeUsd: 0.0616661,
      totalBalanceChange: -0.1,
      totalBalanceChangeUsd: -0.0616661,
      updatedAccountsCount: 8,
      updatedAccounts: [Array],
      blockConfirmationsCount: 161,
      isZkappAccount: false,
      nonce: 3,
      isAccountHijack: null
    }
  }
]
[5:47:12 PM] Getting existing job result...
[5:47:13 PM]  [
  {
    hash: '5JuWn8jjwJNA85JwT5ipxdFRco3C63nGzM79jLjuRHiTxr45XP7L',
    tx: '{"feePayer":{"body":{"publicKey":"B62qmoZqbXP3zRDFiVhczH6XXzHN2jhEq6dT9XqZ4trc1Y8oXyCAJgK","fee":"100000000","validUntil":null,"nonce":"2"},"authorization":"7mWxjoFWXSKmhLVhyGoZTboLfsaswYszJTnnCdd39b78JqXDiHGpeGBCGzEQhmrzMtbCcv1ecUVC8jKhq2tisyzJsVVm2W9s"},"accountUpdates":[{"body":{"publicKey":"B62qmoZqbXP3zRDFiVhczH6XXzHN2jhEq6dT9XqZ4trc1Y8oXyCAJgK","tokenId":"wSHV2S4qX9jFsLjQo8r1BsMLH2ZRKsZx6EJd1sbozGPieEC4Jf","update":{"appState":[null,null,null,null,null,null,null,null],"delegate":null,"verificationKey":null,"permissions":null,"zkappUri":null,"tokenSymbol":null,"timing":null,"votingFor":null},"balanceChange":{"magnitude":"1000000000","sgn":"Negative"},"incrementNonce":false,"events":[],"actions":[],"callData":"0","callDepth":0,"preconditions":{"network":{"snarkedLedgerHash":null,"blockchainLength":null,"minWindowDensity":null,"totalCurrency":null,"globalSlotSinceGenesis":null,"stakingEpochData":{"ledger":{"hash":null,"totalCurrency":null},"seed":null,"startCheckpoint":null,"lockCheckpoint":null,"epochLength":null},"nextEpochData":{"ledger":{"hash":null,"totalCurrency":null},"seed":null,"startCheckpoint":null,"lockCheckpoint":null,"epochLength":null}},"account":{"balance":null,"nonce":null,"receiptChainHash":null,"delegate":null,"state":[null,null,null,null,null,null,null,null],"actionState":null,"provedState":null,"isNew":null},"validWhile":null},"useFullCommitment":true,"implicitAccountCreationFee":false,"mayUseToken":{"parentsOwnToken":false,"inheritFromParent":false},"authorizationKind":{"isSigned":true,"isProved":false,"verificationKeyHash":"3392518251768960475377392625298437850623664973002200885669375116181514017494"}},"authorization":{"proof":null,"signature":"7mWxjoFWXSKmhLVhyGoZTboLfsaswYszJTnnCdd39b78JqXDiHGpeGBCGzEQhmrzMtbCcv1ecUVC8jKhq2tisyzJsVVm2W9s"}},{"body":{"publicKey":"B62qmoZqbXP3zRDFiVhczH6XXzHN2jhEq6dT9XqZ4trc1Y8oXyCAJgK","tokenId":"wSHV2S4qX9jFsLjQo8r1BsMLH2ZRKsZx6EJd1sbozGPieEC4Jf","update":{"appState":[null,null,null,null,null,null,null,null],"delegate":null,"verificationKey":null,"permissions":null,"zkappUri":null,"tokenSymbol":null,"timing":null,"votingFor":null},"balanceChange":{"magnitude":"100000000","sgn":"Negative"},"incrementNonce":false,"events":[],"actions":[],"callData":"0","callDepth":0,"preconditions":{"network":{"snarkedLedgerHash":null,"blockchainLength":null,"minWindowDensity":null,"totalCurrency":null,"globalSlotSinceGenesis":null,"stakingEpochData":{"ledger":{"hash":null,"totalCurrency":null},"seed":null,"startCheckpoint":null,"lockCheckpoint":null,"epochLength":null},"nextEpochData":{"ledger":{"hash":null,"totalCurrency":null},"seed":null,"startCheckpoint":null,"lockCheckpoint":null,"epochLength":null}},"account":{"balance":null,"nonce":null,"receiptChainHash":null,"delegate":null,"state":[null,null,null,null,null,null,null,null],"actionState":null,"provedState":null,"isNew":null},"validWhile":null},"useFullCommitment":true,"implicitAccountCreationFee":false,"mayUseToken":{"parentsOwnToken":false,"inheritFromParent":false},"authorizationKind":{"isSigned":true,"isProved":false,"verificationKeyHash":"3392518251768960475377392625298437850623664973002200885669375116181514017494"}},"authorization":{"proof":null,"signature":"7mWxjoFWXSKmhLVhyGoZTboLfsaswYszJTnnCdd39b78JqXDiHGpeGBCGzEQhmrzMtbCcv1ecUVC8jKhq2tisyzJsVVm2W9s"}},{"body":{"publicKey":"B62qqhvKVk2KEia7awrhNM1nPLUEXDM8WiPut7xXKrNDYDae1JU5GzN","tokenId":"wSHV2S4qX9jFsLjQo8r1BsMLH2ZRKsZx6EJd1sbozGPieEC4Jf","update":{"appState":[null,null,null,null,null,null,null,null],"delegate":null,"verificationKey":null,"permissions":null,"zkappUri":null,"tokenSymbol":null,"timing":null,"votingFor":null},"balanceChange":{"magnitude":"100000000","sgn":"Positive"},"incrementNonce":false,"events":[],"actions":[],"callData":"0","callDepth":1,"preconditions":{"network":{"snarkedLedgerHash":null,"blockchainLength":null,"minWindowDensity":null,"totalCurrency":null,"globalSlotSinceGenesis":null,"stakingEpochData":{"ledger":{"hash":null,"totalCurrency":null},"seed":null,"startCheckpoint":null,"lockCheckpoint":null,"epochLength":null},"nextEpochData":{"ledger":{"hash":null,"totalCurrency":null},"seed":null,"startCheckpoint":null,"lockCheckpoint":null,"epochLength":null}},"account":{"balance":null,"nonce":null,"receiptChainHash":null,"delegate":null,"state":[null,null,null,null,null,null,null,null],"actionState":null,"provedState":null,"isNew":null},"validWhile":null},"useFullCommitment":false,"implicitAccountCreationFee":false,"mayUseToken":{"parentsOwnToken":false,"inheritFromParent":false},"authorizationKind":{"isSigned":false,"isProved":false,"verificationKeyHash":"3392518251768960475377392625298437850623664973002200885669375116181514017494"}},"authorization":{"proof":null,"signature":null}},{"body":{"publicKey":"B62qnguz8GxX4EAfU8vCAgsPPdTt3vUdqfiC1mb3XJBuJi3SSyj6dkX","tokenId":"wSHV2S4qX9jFsLjQo8r1BsMLH2ZRKsZx6EJd1sbozGPieEC4Jf","update":{"appState":[null,null,null,null,null,null,null,null],"delegate":null,"verificationKey":null,"permissions":null,"zkappUri":null,"tokenSymbol":null,"timing":null,"votingFor":null},"balanceChange":{"magnitude":"0","sgn":"Positive"},"incrementNonce":false,"events":[],"actions":[],"callData":"14553243830399830571504000308234036345279750842186650428822828238451059925401","callDepth":0,"preconditions":{"network":{"snarkedLedgerHash":null,"blockchainLength":null,"minWindowDensity":null,"totalCurrency":null,"globalSlotSinceGenesis":null,"stakingEpochData":{"ledger":{"hash":null,"totalCurrency":null},"seed":null,"startCheckpoint":null,"lockCheckpoint":null,"epochLength":null},"nextEpochData":{"ledger":{"hash":null,"totalCurrency":null},"seed":null,"startCheckpoint":null,"lockCheckpoint":null,"epochLength":null}},"account":{"balance":null,"nonce":null,"receiptChainHash":null,"delegate":null,"state":[null,null,null,"0",null,null,null,null],"actionState":null,"provedState":null,"isNew":null},"validWhile":null},"useFullCommitment":false,"implicitAccountCreationFee":false,"mayUseToken":{"parentsOwnToken":false,"inheritFromParent":false},"authorizationKind":{"isSigned":false,"isProved":true,"verificationKeyHash":"22278758441605771858700252645311428360030262698072838723799702480887091310093"}},"authorization":{"proof":"KChzdGF0ZW1lbnQoKHByb29mX3N0YXRlKChkZWZlcnJlZF92YWx1ZXMoKHBsb25rKChhbHBoYSgoaW5uZXIoN2QwYWQ2ODY3YzYzZTQ5YyBlZTRlN2RhNjY3NjQ3OGMyKSkpKShiZXRhKGE0ZGYyYjRmNWY1Njg5MjAgYjc4YjEzNGNjOWU0OTMwZSkpKGdhbW1hKDA0NTMxZjdmZDlmY2QyZDIgZTUwMzE0MTg4YWVjNDVlNykpKHpldGEoKGlubmVyKDcyNzI3ZjQ0OGU4N2Q2ODkgYmVhNjA3ZGQyNjg5YWYzMikpKSkoam9pbnRfY29tYmluZXIoKSkoZmVhdHVyZV9mbGFncygocmFuZ2VfY2hlY2swIGZhbHNlKShyYW5nZV9jaGVjazEgZmFsc2UpKGZvcmVpZ25fZmllbGRfYWRkIGZhbHNlKShmb3JlaWduX2ZpZWxkX211bCBmYWxzZSkoeG9yIGZhbHNlKShyb3QgZmFsc2UpKGxvb2t1cCBmYWxzZSkocnVudGltZV90YWJsZXMgZmFsc2UpKSkpKShidWxsZXRwcm9vZl9jaGFsbGVuZ2VzKCgocHJlY2hhbGxlbmdlKChpbm5lcig0Mzk1ZTlhOWUzNWMxNmVjIDg4NmQyYmNiMWQ5N2UwZjUpKSkpKSgocHJlY2hhbGxlbmdlKChpbm5lcig0NDVjNWFhYjYzMDI2NGU2IGIxMWVlZTdjZmQxMmQ5ZTcpKSkpKSgocHJlY2hhbGxlbmdlKChpbm5lcigwZjE1ZTZjMTM1N2U5NDZjIDUxMzJiYzRhZGQ2YzczZGQpKSkpKSgocHJlY2hhbGxlbmdlKChpbm5lcig2OWY4Mjk4ZWVlZDBjOWRhIDhiOGZjMDQwMDdhNWJlMGMpKSkpKSgocHJlY2hhbGxlbmdlKChpbm5lcihmYWE0ZTVlNmQ0NTA1ODRlIDRhYzQ3YTU4NDE0NDljNWQpKSkpKSgocHJlY2hhbGxlbmdlKChpbm5lcigzZDZlZDUwNDNjNmVmOGRmIGZjZGExNzA3Mjk1Y2E2ZWIpKSkpKSgocHJlY2hhbGxlbmdlKChpbm5lcigyMzE5NzUyYzQ5NGU4NDQyIGQ2ODU5MmNjODYyYWQyNDgpKSkpKSgocHJlY2hhbGxlbmdlKChpbm5lcigyZjMyOTMyYzg5NjBiYTdmIDYzNDYwY2ExNzZmMzYwOTkpKSkpKSgocHJlY2hhbGxlbmdlKChpbm5lcigzZjY2NTgyZjRlMmFiNWM3IDFmYjRkOWQ2MWQwYzZlOGIpKSkpKSgocHJlY2hhbGxlbmdlKChpbm5lcihjZmY0ZTk4MzdkYTMwOGVmIGVlYWVhNDg3MTA4MTQ2ZWIpKSkpKSgocHJlY2hhbGxlbmdlKChpbm5lcihiMGI3Njg0NDRmOTEyMWM5IDQ0MTMxNzcyMTdhMGU2MjkpKSkpKSgocHJlY2hhbGxlbmdlKChpbm5lcig0ZGYyNDJlYzVlZmQxNTcxIGY5ZDI2NDVlNDhhZjM1ZTkpKSkpKSgocHJlY2hhbGxlbmdlKChpbm5lcihhN2Y3NTM0YjgxM2YzNzM4IDQwM2JjNmFiMDIwZTJlN2UpKSkpKSgocHJlY2hhbGxlbmdlKChpbm5lcigxNjkyNTA5OTI1OWY3ZTFkIDA4MTVmZWViMTMzNzdjYzQpKSkpKSgocHJlY2hhbGxlbmdlKChpbm5lcigwZmFkNDBiYWE5NGE3ZjRiIDllOGFkODUyNmQ4MGM4OWQpKSkpKSgocHJlY2hhbGxlbmdlKChpbm5lcig1MjFkZjAwNDA1MDg5NTQ1IGRkMTk2MTY5NTBhMDQ1OTYpKSkpKSkpKGJyYW5jaF9kYXRhKChwcm9vZnNfdmVyaWZpZWQgTjApKGRvbWFpbl9sb2cyIlwwMTEiKSkpKSkoc3BvbmdlX2RpZ2VzdF9iZWZvcmVfZXZhbHVhdGlvbnMoMWE2N2NhMTQyN2JhOWRjYiAwYmFjNGNmOGNhN2ViYmIyIDA0NmZlZDQyYTAzMmQyYTggMTkzMjk0NGRhNjg3NjA5OCkpKG1lc3NhZ2VzX2Zvcl9uZXh0X3dyYXBfcHJvb2YoKGNoYWxsZW5nZV9wb2x5bm9taWFsX2NvbW1pdG1lbnQoMHgzMERDNjNGNzY1RkIxMzA0ODgyQzFCQTMxMUQwRDYxRUY1RjkyODY4MjNFMjNCNDkxM0Y0MEZDMTQzQzcyRjAwIDB4MDI0NzQzNUJGNDIzNjYzNjhBRTE1RUZBQjE2ODIyNUYzNTYxNzA3OTE3Q0VDMTZENzcxMjlFOTMwMjkzOEE4NCkpKG9sZF9idWxsZXRwcm9vZl9jaGFsbGVuZ2VzKCgoKHByZWNoYWxsZW5nZSgoaW5uZXIoMzM4MmIzYzlhY2U2YmY2ZiA3OTk3NDM1OGY5NzYxODYzKSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoZGQzYTJiMDZlOTg4ODc5NyBkZDdhZTY0MDI5NDRhMWM3KSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoYzZlOGU1MzBmNDljOWZjYiAwN2RkYmI2NWNkYTA5Y2RkKSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoNTMyYzU5YTI4NzY5MWExMyBhOTIxYmNiMDJhNjU2ZjdiKSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoZTI5Yzc3YjE4ZjEwMDc4YiBmODVjNWYwMGRmNmIwY2VlKSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoMWRiZGE3MmQwN2IwOWM4NyA0ZDFiOTdlMmU5NWYyNmEwKSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoOWM3NTc0N2M1NjgwNWYxMSBhMWZlNjM2OWZhY2VmMWU4KSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoNWMyYjhhZGZkYmU5NjA0ZCA1YThjNzE4Y2YyMTBmNzliKSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoMjJjMGIzNWM1MWUwNmI0OCBhNjg4OGI3MzQwYTk2ZGVkKSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoOTAwN2Q3YjU1ZTc2NjQ2ZSBjMWM2OGIzOWRiNGU4ZTEyKSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoNDQ0NWUzNWUzNzNmMmJjOSA5ZDQwYzcxNWZjOGNjZGU1KSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoNDI5ODgyODQ0YmJjYWE0ZSA5N2E5MjdkN2QwYWZiN2JjKSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoOTljYTNkNWJmZmZkNmU3NyBlZmU2NmE1NTE1NWM0Mjk0KSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoNGI3ZGIyNzEyMTk3OTk1NCA5NTFmYTJlMDYxOTNjODQwKSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoMmNkMWNjYmViMjA3NDdiMyA1YmQxZGUzY2YyNjQwMjFkKSkpKSkpKCgocHJlY2hhbGxlbmdlKChpbm5lcigzMzgyYjNjOWFjZTZiZjZmIDc5OTc0MzU4Zjk3NjE4NjMpKSkpKSgocHJlY2hhbGxlbmdlKChpbm5lcihkZDNhMmIwNmU5ODg4Nzk3IGRkN2FlNjQwMjk0NGExYzcpKSkpKSgocHJlY2hhbGxlbmdlK'... 31522 more characters
  }
]
[5:47:13 PM] Getting existing token info...
[5:47:14 PM]  [
  {
    tokenAddress: 'B62qn25cKc4ipqJMCDSMENgsiFwL49vTdnsDXgWWKWFXQaY819rn848',
    tokenId: 'wgFChbXahE7h8mUbPDma6K1kq67cesgjdPeQ2hSDRro2VAJQio',
    adminContractAddress: 'B62qq55MxGd8UjN3vEz2HJZNMcKCFzi9fvnZ6vmNXiRf6MNqaNos266',
    adminAddress: 'B62qjFmTAzmLvPXRhUn8H83BoqtQxFtqHe8DkYBrj44TP6uKWWNfa1a',
    adminTokenBalance: 0,
    totalSupply: 100,
    isPaused: false,
    decimals: 9,
    tokenSymbol: 'TEST',
    verificationKeyHash: '22278758441605771858700252645311428360030262698072838723799702480887091310093',
    uri: 'https://minatokens.com',
    version: 0,
    adminTokenSymbol: '',
    adminUri: 'https://minatokens.com',
    adminVerificationKeyHash: '15958550144671703080408884627087990244648824766878280780120011347457437134053',
    adminVersion: 0
  }
]
[5:47:14 PM] Getting existing NFT info...
[5:47:15 PM]  [
  {
    contractAddress: 'B62qs2NthDuxAT94tTFg6MtuaP1gaBxTZyNv9D3uQiQciy1VsaimNFT',
    nftAddress: 'B62qoT6jXebkJVmsUmxCxGJmvHJUXPNF417rms4PATi5R6Hw7e56CRt',
    tokenId: 'wXqDrUzWtK58CaWCzN2g3zseU275dhSnRtBthcroeqT6HGKkos',
    tokenSymbol: 'NFT',
    contractUri: 'https://minanft.io',
    name: 'Minaty 0001',
    metadataRoot: {
      data: '12679389298125948166059309544447259892894738673204711267274310664702682460795',
      kind: '27125089194256017147736279796017779599844703410798002747911858803632742670820'
    },
    storage: 'bafkreiffyjf6lpxw5uzniwam7lv7oyezfsxnnfj3yeo67ht3nch3gvgvwi',
    owner: 'B62qkX4VQYdmgc7dmLyiPpMhLRfrWjWnyoGGhdqF4bXtTcbv6E1HWsD',
    price: 0,
    version: 1,
    algolia: {
      name: 'Minaty 0001',
      chain: 'devnet',
      contractAddress: 'B62qs2NthDuxAT94tTFg6MtuaP1gaBxTZyNv9D3uQiQciy1VsaimNFT',
      owner: 'B62qkX4VQYdmgc7dmLyiPpMhLRfrWjWnyoGGhdqF4bXtTcbv6E1HWsD',
      price: '0',
      status: 'applied',
      jobId: 'zkCWTQSsqyytppGBMw2YclHjuDmMjlrEKoVr2wzZwaQGiziG',
      ipfs: 'bafkreiffyjf6lpxw5uzniwam7lv7oyezfsxnnfj3yeo67ht3nch3gvgvwi',
      version: '1',
      hash: '5JtvxgKwahMjsgsj13oi5bxW2Birgu3a8CDERQ9UMQRBPcF39qHP',
      collection: 'Minaty Anonymous Private Club',
      address: 'B62qoT6jXebkJVmsUmxCxGJmvHJUXPNF417rms4PATi5R6Hw7e56CRt',
      description: '##Minaty 0001: The Emblem of the Founder\n' +
        '\n' +
        '**Minaty 0001 is not just an NFT**; it embodies the very essence of the vision that drives the Minaty project. As a unique and non-transferable piece, it symbolizes the presence, conviction, and leadership of the founder. This NFT reflects your personal journey as a creator, merging passion, overcoming challenges, and the mission to inspire a community to reclaim control over their data and defend privacy in the Web3 space.\n' +
        '\n' +
        '**What Makes Minaty 0001 Unique:**\n' +
        '\n' +
        '- **Founder’s Identity:** Minaty 0001 is exclusively reserved for its creator. It will never be sold or traded, representing the personal and unbreakable bond between the founder and the project.\n' +
        '- **Symbol of Leadership:** This NFT stands as a testament to your role as a guide and innovator, serving as an example and rallying point for those who believe in a new digital era.\n' +
        "- **Vision and Values:** Minaty 0001 is a constant reminder of the project's mission: to champion digital freedom, promote privacy, and push the boundaries of what is possible in the Web3 ecosystem.\n" +
        '\n' +
        '**Message from the Founder:** “Minaty 0001 is more than just an NFT. It is my personal emblem, a proof of my commitment to the Minaty community, and an expression of my values as a leader in this digital revolution. This NFT is a declaration of who I am, what I stand for, and what I strive to build every day.',
      image: 'https://gateway.pinata.cloud/ipfs/bafybeigj6f2hmwuikmwiwfmfaicysz55qmuw3o3bnfo6ikcycfeuhve6jm',
      external_url: 'https://minascan.io/devnet/account/B62qoT6jXebkJVmsUmxCxGJmvHJUXPNF417rms4PATi5R6Hw7e56CRt',
      time: 1727251779058,
      metadata: [Object],
      properties: [Object],
      objectID: 'devnet.B62qs2NthDuxAT94tTFg6MtuaP1gaBxTZyNv9D3uQiQciy1VsaimNFT.Minaty 0001'
    },
    metadata: {
      name: 'Minaty 0001',
      collection: 'Minaty Anonymous Private Club',
      address: 'B62qoT6jXebkJVmsUmxCxGJmvHJUXPNF417rms4PATi5R6Hw7e56CRt',
      description: '##Minaty 0001: The Emblem of the Founder\n' +
        '\n' +
        '**Minaty 0001 is not just an NFT**; it embodies the very essence of the vision that drives the Minaty project. As a unique and non-transferable piece, it symbolizes the presence, conviction, and leadership of the founder. This NFT reflects your personal journey as a creator, merging passion, overcoming challenges, and the mission to inspire a community to reclaim control over their data and defend privacy in the Web3 space.\n' +
        '\n' +
        '**What Makes Minaty 0001 Unique:**\n' +
        '\n' +
        '- **Founder’s Identity:** Minaty 0001 is exclusively reserved for its creator. It will never be sold or traded, representing the personal and unbreakable bond between the founder and the project.\n' +
        '- **Symbol of Leadership:** This NFT stands as a testament to your role as a guide and innovator, serving as an example and rallying point for those who believe in a new digital era.\n' +
        "- **Vision and Values:** Minaty 0001 is a constant reminder of the project's mission: to champion digital freedom, promote privacy, and push the boundaries of what is possible in the Web3 ecosystem.\n" +
        '\n' +
        '**Message from the Founder:** “Minaty 0001 is more than just an NFT. It is my personal emblem, a proof of my commitment to the Minaty community, and an expression of my values as a leader in this digital revolution. This NFT is a declaration of who I am, what I stand for, and what I strive to build every day.',
      image: 'https://gateway.pinata.cloud/ipfs/bafybeigj6f2hmwuikmwiwfmfaicysz55qmuw3o3bnfo6ikcycfeuhve6jm',
      external_url: 'https://minascan.io/devnet/account/B62qoT6jXebkJVmsUmxCxGJmvHJUXPNF417rms4PATi5R6Hw7e56CRt',
      time: 1727251779058,
      metadata: [Object],
      properties: [Object]
    }
  }
]
[5:47:15 PM] Calling faucet for key: {
  privateKey: 'EKF6pVuFihtj2YDjQxumLsVnR6Wxhkk1RPCCxNjVjaDFKSjq1L1z',
  publicKey: 'B62qopj3yrRQeXCANvDixjLaQHi28tuEpoefj3tGFN1zLPw9jSkYqby'
}
[5:47:18 PM] Faucet response for B62qopj3yrRQeXCANvDixjLaQHi28tuEpoefj3tGFN1zLPw9jSkYqby: {
  success: true,
  hash: '5Ju2LyumgCnjYJp3qeWTBUVkzyexy5FSzgFCGuBbViDKC2q6qkuC'
}
[5:47:18 PM] Deploying new token...
[5:47:18 PM] Admin address: B62qjFmTAzmLvPXRhUn8H83BoqtQxFtqHe8DkYBrj44TP6uKWWNfa1a
[5:47:24 PM] Token address: B62qosmNw1Rhv8Nt2J3dUkdFEPtDRrjS4hD4TgMK1J8CU5aDXCLu3hB
[5:47:24 PM] Admin contract address: B62qpU2avniJUFrR8g15asMjHNsJYq4zDAbvehdCNZr4M5gAPgfM5DT
[5:47:27 PM] Job ID: zkCWkLaoxz2qckjoaI2fjtyiqO0aDYIunwT3QgBLOfwdzrmM
[5:47:27 PM] Waiting for job result...
[5:48:20 PM] Transaction hash: 5JuvmEnFK4SBmk8biTZtAQaRKbrbjMPuffLvhpDsbvBKFQipJ4RQ
[5:48:20 PM] Waiting for transaction 5JuvmEnFK4SBmk8biTZtAQaRKbrbjMPuffLvhpDsbvBKFQipJ4RQ to be included in a block...
[5:51:34 PM] Transaction 5JuvmEnFK4SBmk8biTZtAQaRKbrbjMPuffLvhpDsbvBKFQipJ4RQ included in a block {
  hash: '5JuvmEnFK4SBmk8biTZtAQaRKbrbjMPuffLvhpDsbvBKFQipJ4RQ',
  status: 'applied'
}
[5:51:36 PM]  [
  {
    tokenAddress: 'B62qosmNw1Rhv8Nt2J3dUkdFEPtDRrjS4hD4TgMK1J8CU5aDXCLu3hB',
    tokenId: 'x1JtYG6JrvLbsNUx3GF5dCKhQEHNzA9gXKgeEZaYyoHMFY6NC1',
    adminContractAddress: 'B62qpU2avniJUFrR8g15asMjHNsJYq4zDAbvehdCNZr4M5gAPgfM5DT',
    adminAddress: 'B62qjFmTAzmLvPXRhUn8H83BoqtQxFtqHe8DkYBrj44TP6uKWWNfa1a',
    adminTokenBalance: 0,
    totalSupply: 0,
    isPaused: false,
    decimals: 9,
    tokenSymbol: 'TEST',
    verificationKeyHash: '22278758441605771858700252645311428360030262698072838723799702480887091310093',
    uri: 'https://minatokens.com',
    version: 0,
    adminTokenSymbol: '',
    adminUri: 'https://minatokens.com',
    adminVerificationKeyHash: '15958550144671703080408884627087990244648824766878280780120011347457437134053',
    adminVersion: 0
  }
]
[5:51:36 PM] Building mint transaction...
[5:51:44 PM] Job ID: zkCWCibpPsXEos0fTFvgZSLFO31DVS3QbrJUuIcOIFLYF2ji
[5:51:44 PM] Waiting for job result...
[5:52:37 PM] Transaction hash: 5JuN4MMFiwhNCWvakbxZsmrjry34RJmykhdQQAF6x7gy4UsNXTje
[5:52:37 PM] Waiting for transaction 5JuN4MMFiwhNCWvakbxZsmrjry34RJmykhdQQAF6x7gy4UsNXTje to be included in a block...
[5:55:19 PM] Transaction 5JuN4MMFiwhNCWvakbxZsmrjry34RJmykhdQQAF6x7gy4UsNXTje included in a block {
  hash: '5JuN4MMFiwhNCWvakbxZsmrjry34RJmykhdQQAF6x7gy4UsNXTje',
  status: 'applied'
}
[5:55:22 PM]  [
  {
    tokenAddress: 'B62qosmNw1Rhv8Nt2J3dUkdFEPtDRrjS4hD4TgMK1J8CU5aDXCLu3hB',
    tokenId: 'x1JtYG6JrvLbsNUx3GF5dCKhQEHNzA9gXKgeEZaYyoHMFY6NC1',
    adminContractAddress: 'B62qpU2avniJUFrR8g15asMjHNsJYq4zDAbvehdCNZr4M5gAPgfM5DT',
    adminAddress: 'B62qjFmTAzmLvPXRhUn8H83BoqtQxFtqHe8DkYBrj44TP6uKWWNfa1a',
    adminTokenBalance: 0,
    totalSupply: 100,
    isPaused: false,
    decimals: 9,
    tokenSymbol: 'TEST',
    verificationKeyHash: '22278758441605771858700252645311428360030262698072838723799702480887091310093',
    uri: 'https://minatokens.com',
    version: 0,
    adminTokenSymbol: '',
    adminUri: 'https://minatokens.com',
    adminVerificationKeyHash: '15958550144671703080408884627087990244648824766878280780120011347457437134053',
    adminVersion: 0
  }
]
[5:55:22 PM] Building transfer transaction...
[5:55:29 PM] Job ID: zkCWd2mixfUxkZkdtaIxvgZVd3UNyxzvoYIuGexXcRsNQF0BB
[5:55:29 PM] Waiting for job result...
[5:55:50 PM] Transaction hash: 5JtmGKk6ygAmukVmMUtErvy7ANugaPP2Ys5mic64x6nCabxxpagE
[5:55:50 PM] Waiting for transaction 5JtmGKk6ygAmukVmMUtErvy7ANugaPP2Ys5mic64x6nCabxxpagE to be included in a block...
[6:03:53 PM] Transaction 5JtmGKk6ygAmukVmMUtErvy7ANugaPP2Ys5mic64x6nCabxxpagE included in a block {
  hash: '5JtmGKk6ygAmukVmMUtErvy7ANugaPP2Ys5mic64x6nCabxxpagE',
  status: 'applied'
}
[6:03:54 PM]  [
  {
    tokenAddress: 'B62qosmNw1Rhv8Nt2J3dUkdFEPtDRrjS4hD4TgMK1J8CU5aDXCLu3hB',
    tokenId: 'x1JtYG6JrvLbsNUx3GF5dCKhQEHNzA9gXKgeEZaYyoHMFY6NC1',
    adminContractAddress: 'B62qpU2avniJUFrR8g15asMjHNsJYq4zDAbvehdCNZr4M5gAPgfM5DT',
    adminAddress: 'B62qjFmTAzmLvPXRhUn8H83BoqtQxFtqHe8DkYBrj44TP6uKWWNfa1a',
    adminTokenBalance: 0,
    totalSupply: 100,
    isPaused: false,
    decimals: 9,
    tokenSymbol: 'TEST',
    verificationKeyHash: '22278758441605771858700252645311428360030262698072838723799702480887091310093',
    uri: 'https://minatokens.com',
    version: 0,
    adminTokenSymbol: '',
    adminUri: 'https://minatokens.com',
    adminVerificationKeyHash: '15958550144671703080408884627087990244648824766878280780120011347457437134053',
    adminVersion: 0
  }
]
 PASS  tests/token.test.ts
  MinaTokensAPI
    ✓ should get transaction status (3614 ms)
    ✓ should get job result (896 ms)
    ✓ should get existing token info (1016 ms)
    ✓ should get existing NFT info (1541 ms)
    ✓ should call faucet (2492 ms)
    ✓ should deploy token (257630 ms)
    ✓ should mint token (226585 ms)
    ✓ should transfer token (512187 ms)

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
Snapshots:   0 total
Time:        1007.034 s
Ran all test suites.


```
