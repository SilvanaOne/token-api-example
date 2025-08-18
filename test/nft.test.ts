import { describe, it } from "node:test";
import assert from "node:assert";
import Client from "mina-signer";
import * as api from "@silvana-one/api";
import "dotenv/config";
import {
  randomName,
  randomText,
  randomImage,
  randomBanner,
} from "../src/random.js";
import fs from "fs/promises";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY not found in environment variables");
}

const TEST_ACCOUNTS = Array.from({ length: 25 }, (_, i) => {
  const privateKey = process.env[`TEST_ACCOUNT_${i + 1}_PRIVATE_KEY`];
  const publicKey = process.env[`TEST_ACCOUNT_${i + 1}_PUBLIC_KEY`];
  if (!privateKey || !publicKey) {
    throw new Error(
      `TEST_ACCOUNT_${i + 1} keys not found in environment variables`
    );
  }
  return { privateKey, publicKey };
});

/*
Frontend: https://devnet.minanft.io/
API: https://docs.zkcloudworker.com/OpenAPI/launch-nft-collection
*/

type Chain = "zeko" | "devnet" | "mainnet";
const chain: Chain = "zeko" as Chain;
console.log("chain:", chain);
const soulBound = false as boolean; // set to true to mint soulbound NFTs

api.config({
  apiKey: API_KEY,
  chain,
});
const debug = false;
if (debug) {
  console.log("Debug mode enabled");
  process.env.DEBUG = "true";
}

const client = new Client({
  network: chain === "mainnet" ? "mainnet" : "testnet",
});

const exampleNftAddress =
  chain === "zeko"
    ? "B62qmma6ijpWZ4dURYH2xDL3ue2f9fcafz5tvBZCsBw4XmaV16KDJNe"
    : "B62qmDBN6M9WttVwrke92ebumkeBQvXuN11dGUKLTwLd7pvwSAJhCN3";

const exampleCollectionAddress =
  chain === "zeko"
    ? "B62qisXk3LaFKRSmpFU6GVPfcoQsAu1K3iVM2DC9U18XJSb8XtnN6cD"
    : "B62qkRw5We6g8ywCvAq3teAMgSYzREqMcisT3dwht2W4swA9ha89mvQ";

describe("MinaTokensAPI for NFT", () => {
  let collectionAddress: string | undefined = undefined;
  let nftAddress: string | undefined = undefined;
  const users = TEST_ACCOUNTS;
  const creator = users[7];
  const nftHolders = users.slice(1);
  const nftAddresses: string[] = [];

  let step:
    | "started"
    | "launched"
    | "minted"
    | "approved"
    | "sell"
    | "bought"
    | "transferred"
    | "batchMint"
    | "batchSell" = "started";

  it.skip(`should get NFT info`, async () => {
    const info = (
      await api.getNftInfo({
        body: {
          nftAddress: exampleNftAddress,
          collectionAddress: exampleCollectionAddress,
        },
      })
    ).data;
    console.log("NFT info:", info);
  });

  it(`should launch NFT collection`, async () => {
    console.log("creator:", creator.publicKey);

    const collectionName = randomName();
    console.log(`Launching new NFT collection ${collectionName}...`);

    const tx = (
      await api.launchNftCollection({
        body: {
          collectionName,
          sender: creator.publicKey,
          adminContract: "standard",
          symbol: "NFT",
          masterNFT: {
            name: collectionName,
            data: {
              owner: creator.publicKey,
            },
            metadata: {
              name: collectionName,
              image: randomImage(),
              banner: randomBanner(),
              description: randomText(),
              traits: [
                {
                  key: "Collection Public Trait 1",
                  type: "string",
                  value: "Collection Public Value 1",
                },
                {
                  key: "Collection Private Trait 2",
                  type: "string",
                  value: "Collection Private Value 2",
                  isPrivate: true,
                },
              ],
            },
          },
        },
      })
    ).data;
    if (!tx) throw new Error("Token not deployed");

    const { minaSignerPayload } = tx;
    if (!tx.request || !("adminContractAddress" in tx.request))
      throw new Error("NFT collection is not deployed");
    const adminContractAddress = tx?.request?.adminContractAddress;
    collectionAddress = tx?.request?.collectionAddress;
    if (!collectionAddress) throw new Error("NFT collection is not deployed");
    console.log("NFT collection address:", collectionAddress);
    console.log("Admin contract address:", adminContractAddress);
    console.log("Storage address:", tx?.storage);
    console.log("Metadata root:", tx?.metadataRoot);
    if (tx?.privateMetadata && collectionAddress) {
      await fs.writeFile(
        `./data/collection-${collectionAddress}-metadata.json`,
        tx.privateMetadata
      );
    }

    if (collectionAddress) {
      await fs.writeFile(
        `./data/collection-${collectionAddress}-keys.json`,
        JSON.stringify(
          {
            collectionName,
            collectionAddress,
            masterNFT: tx?.nftName,
            adminContractAddress,
            collectionContractPrivateKey:
              tx?.request?.collectionContractPrivateKey,
            adminContractPrivateKey: tx?.request?.adminContractPrivateKey,
            storage: tx?.storage,
            metadataRoot: tx?.metadataRoot,
          },
          null,
          2
        )
      );
    }

    const proveTx = (
      await api.prove({
        body: {
          tx,
          signedData: JSON.stringify(
            client.signTransaction(minaSignerPayload as any, creator.privateKey)
              .data
          ),
        },
      })
    ).data;

    if (!proveTx?.jobId) throw new Error("No jobId");

    const proofs = await api.waitForProofs(proveTx?.jobId);
    assert.ok(proofs, "proofs should be defined");
    if (!proofs) throw new Error("No proofs");
    assert.strictEqual(proofs.length, 1);
    const hash = proofs[0];
    assert.ok(hash, "hash should be defined");
    if (!hash) throw new Error("No hash");
    await api.waitForTransaction(hash);
    await sleep(30000);
    const info = (
      await api.getNftInfo({
        body: {
          collectionAddress,
        },
      })
    ).data;
    console.log("Collection info:", info);
    step = "launched";
  });

  it(`should mint NFT`, async () => {
    assert.ok(collectionAddress, "collectionAddress should be defined");
    if (!collectionAddress) {
      throw new Error("NFT collection is not deployed");
    }
    assert.strictEqual(step, "launched");
    const nftName = randomName();
    console.log(`Minting NFT ${nftName}...`);

    const tx = (
      await api.mintNft({
        body: {
          txType: "nft:mint",
          sender: creator.publicKey,
          collectionAddress,
          nftMintParams: {
            name: nftName,
            data: {
              owner: creator.publicKey,
              canApprove: !soulBound,
              canTransfer: !soulBound,
              canChangeMetadata: false,
              canChangeMetadataVerificationKeyHash: false,
              canChangeName: false,
              canChangeOwnerByProof: false,
              canChangeStorage: false,
              canPause: true,
            },
            metadata: {
              name: nftName,
              image: randomImage(),
              description: randomText(),
              traits: [
                {
                  key: "NFT Trait 1",
                  type: "string",
                  value: "NFT Value 1",
                },
                {
                  key: "NFT Trait 2",
                  type: "string",
                  value: "NFT private value 2",
                  isPrivate: true,
                },
              ],
            },
          },
        },
      })
    ).data;
    if (!tx) throw new Error("No tx");
    const nftMintParams = (tx?.request as api.NftMintTransactionParams)
      .nftMintParams;
    nftAddress = nftMintParams?.address;
    if (!nftAddress) throw new Error("NFT not minted");
    console.log("NFT address:", nftAddress);
    console.log("Storage address:", tx?.storage);
    console.log("Metadata root:", tx?.metadataRoot);
    if (tx?.privateMetadata && collectionAddress && nftAddress) {
      await fs.writeFile(
        `./data/nft-${collectionAddress}-${nftAddress}.json`,
        tx.privateMetadata
      );
    }
    if (collectionAddress) {
      await fs.writeFile(
        `./data/nft-${collectionAddress}-${nftAddress}-keys.json`,
        JSON.stringify(
          {
            nftName,
            collectionName: tx?.collectionName,
            collectionAddress,
            nftAddress,
            nftContractPrivateKey: nftMintParams?.addressPrivateKey,
            storage: tx?.storage,
            metadataRoot: tx?.metadataRoot,
          },
          null,
          2
        )
      );
    }
    const proveTx = (
      await api.prove({
        body: {
          tx,
          signedData: JSON.stringify(
            client.signTransaction(
              tx.minaSignerPayload as any,
              creator.privateKey
            ).data
          ),
        },
      })
    ).data;

    if (!proveTx?.jobId) throw new Error("No jobId");

    const proofs = await api.waitForProofs(proveTx.jobId);
    assert.ok(proofs, "proofs should be defined");
    if (!proofs) throw new Error("No proofs");
    assert.strictEqual(proofs.length, 1);
    const hash = proofs[0];
    assert.ok(hash, "hash should be defined");
    if (!hash) return;
    await api.waitForTransaction(hash);
    await sleep(30000);
    const status = await api.txStatus({
      body: { hash },
    });
    console.log("Tx status:", hash, status?.data);
    assert.strictEqual(status?.data?.status, "applied");
    const info = (
      await api.getNftInfo({
        body: {
          collectionAddress,
          nftAddress,
        },
      })
    ).data;
    console.log("NFT info:", info);
    assert.strictEqual(info?.nft.owner, creator.publicKey);
    step = "minted";
  });

  it(`should grant approval`, async () => {
    assert.ok(collectionAddress, "collectionAddress should be defined");
    if (!collectionAddress) {
      throw new Error("NFT collection is not deployed");
    }
    if (!nftAddress) {
      throw new Error("NFT is not minted");
    }
    assert.strictEqual(step, "minted");
    console.log(`Granting approval...`);

    try {
      const tx = (
        await api.approveNft({
          body: {
            txType: "nft:approve",
            sender: creator.publicKey,
            collectionAddress,
            nftAddress,
            nftApproveParams: {
              to: nftHolders[3].publicKey,
            },
          },
        })
      ).data;
      if (!tx) throw new Error("No tx");

      const proveTx = (
        await api.prove({
          body: {
            tx,
            signedData: JSON.stringify(
              client.signTransaction(
                tx.minaSignerPayload as any,
                creator.privateKey
              ).data
            ),
          },
        })
      ).data;

      if (!proveTx?.jobId) throw new Error("No jobId");

      const proofs = await api.waitForProofs(proveTx.jobId);
      assert.ok(proofs, "proofs should be defined");
      if (!proofs) throw new Error("No proofs");
      assert.strictEqual(proofs.length, 1);
      const hash = proofs[0];
      assert.ok(hash, "hash should be defined");
      if (!hash) return;
      await api.waitForTransaction(hash);
      await new Promise((resolve) => setTimeout(resolve, 30000));
      const status = await api.txStatus({
        body: { hash },
      });
      console.log("Tx status:", hash, status?.data);
      assert.strictEqual(status?.data?.status, "applied");
      await sleep(30000);
      const info = (
        await api.getNftInfo({
          body: {
            collectionAddress,
            nftAddress,
          },
        })
      ).data;
      console.log("Approved:", info?.nft.approved);
      console.log("Approved vk:", info?.nft.approvedVerificationKeyHash);
      console.log("Approved type:", info?.nft.approvedType);
      console.log("Price:", info?.nft.price);
      assert.strictEqual(info?.nft.approved, nftHolders[3].publicKey);
    } catch (e: any) {
      if (soulBound) {
        console.log("Soul bound NFT, approve failed as expected");
      } else {
        throw e;
      }
    }
    step = "approved";
  });

  it(`should sell NFT`, async () => {
    assert.ok(collectionAddress, "collectionAddress should be defined");
    if (!collectionAddress) {
      throw new Error("NFT collection is not deployed");
    }
    if (!nftAddress) {
      throw new Error("NFT is not minted");
    }
    assert.strictEqual(step, "approved");
    console.log(`Selling NFT...`);

    try {
      const tx = (
        await api.sellNft({
          body: {
            txType: "nft:sell",
            sender: creator.publicKey,
            collectionAddress,
            nftAddress,
            nftSellParams: {
              price: 10,
            },
          },
        })
      ).data;
      if (!tx) throw new Error("No tx");

      const proveTx = (
        await api.prove({
          body: {
            tx,
            signedData: JSON.stringify(
              client.signTransaction(
                tx.minaSignerPayload as any,
                creator.privateKey
              ).data
            ),
          },
        })
      ).data;

      if (!proveTx?.jobId) throw new Error("No jobId");

      const proofs = await api.waitForProofs(proveTx.jobId);
      assert.ok(proofs, "proofs should be defined");
      if (!proofs) throw new Error("No proofs");
      assert.strictEqual(proofs.length, 1);
      const hash = proofs[0];
      assert.ok(hash, "hash should be defined");
      if (!hash) return;
      await api.waitForTransaction(hash);
      await sleep(30000);
      const status = await api.txStatus({
        body: { hash },
      });
      console.log("Tx status:", hash, status?.data);
      assert.strictEqual(status?.data?.status, "applied");
      const info = (
        await api.getNftInfo({
          body: {
            collectionAddress,
            nftAddress,
          },
        })
      ).data;
      console.log("Approved:", info?.nft.approved);
      console.log("Approved vk:", info?.nft.approvedVerificationKeyHash);
      console.log("Approved type:", info?.nft.approvedType);
      console.log("Price:", info?.nft.price);
      assert.strictEqual(info?.nft.price, 10);
      assert.notStrictEqual(info?.nft.approved, nftHolders[3].publicKey);
    } catch (e: any) {
      if (soulBound) {
        console.log("Soul bound NFT, sell failed as expected");
      } else {
        throw e;
      }
    }
    step = "sell";
  });

  it(`should buy NFT`, async () => {
    assert.ok(collectionAddress, "collectionAddress should be defined");
    if (!collectionAddress) {
      throw new Error("NFT collection is not deployed");
    }
    if (!nftAddress) {
      throw new Error("NFT is not minted");
    }
    assert.strictEqual(step, "sell");
    console.log(`Buying NFT...`);

    try {
      const tx = (
        await api.buyNft({
          body: {
            txType: "nft:buy",
            sender: nftHolders[0].publicKey,
            collectionAddress,
            nftAddress,
            nftBuyParams: {
              buyer: nftHolders[0].publicKey,
            },
          },
        })
      ).data;
      if (!tx) throw new Error("No tx");

      const proveTx = (
        await api.prove({
          body: {
            tx,
            signedData: JSON.stringify(
              client.signTransaction(
                tx.minaSignerPayload as any,
                nftHolders[0].privateKey
              ).data
            ),
          },
        })
      ).data;

      if (!proveTx?.jobId) throw new Error("No jobId");

      const proofs = await api.waitForProofs(proveTx.jobId);
      assert.ok(proofs, "proofs should be defined");
      if (!proofs) throw new Error("No proofs");
      assert.strictEqual(proofs.length, 1);
      const hash = proofs[0];
      assert.ok(hash, "hash should be defined");
      if (!hash) return;
      await api.waitForTransaction(hash);
      await sleep(30000);
      const status = await api.txStatus({
        body: { hash },
      });
      console.log("Tx status:", hash, status?.data);
      assert.strictEqual(status?.data?.status, "applied");
      const info = (
        await api.getNftInfo({
          body: {
            collectionAddress,
            nftAddress,
          },
        })
      ).data;
      console.log("Old owner:", creator.publicKey);
      console.log("New owner:", nftHolders[0].publicKey);
      console.log("NFT info:", info);
      assert.strictEqual(info?.nft.owner, nftHolders[0].publicKey);
    } catch (e: any) {
      if (soulBound) {
        console.log("Soul bound NFT, buy failed as expected");
      } else {
        throw e;
      }
    }
    step = "bought";
  });

  it(`should transfer NFT`, async () => {
    assert.ok(collectionAddress, "collectionAddress should be defined");
    if (!collectionAddress) {
      throw new Error("NFT collection is not deployed");
    }
    if (!nftAddress) {
      throw new Error("NFT is not minted");
    }
    assert.strictEqual(step, "bought");
    console.log(`Transferring NFT...`);

    try {
      const tx = (
        await api.transferNft({
          body: {
            txType: "nft:transfer",
            sender: nftHolders[0].publicKey,
            collectionAddress,
            nftAddress,
            nftTransferParams: {
              from: nftHolders[0].publicKey,
              to: nftHolders[1].publicKey,
            },
          },
        })
      ).data;
      if (!tx) throw new Error("No tx");

      const proveTx = (
        await api.prove({
          body: {
            tx,
            signedData: JSON.stringify(
              client.signTransaction(
                tx.minaSignerPayload as any,
                nftHolders[0].privateKey
              ).data
            ),
          },
        })
      ).data;

      if (!proveTx?.jobId) throw new Error("No jobId");

      const proofs = await api.waitForProofs(proveTx.jobId);
      assert.ok(proofs, "proofs should be defined");
      if (!proofs) throw new Error("No proofs");
      assert.strictEqual(proofs.length, 1);
      const hash = proofs[0];
      assert.ok(hash, "hash should be defined");
      if (!hash) return;
      await api.waitForTransaction(hash);
      await sleep(30000);
      const status = await api.txStatus({
        body: { hash },
      });
      console.log("Tx status:", hash, status?.data);
      assert.strictEqual(status?.data?.status, "applied");
      const info = (
        await api.getNftInfo({
          body: {
            collectionAddress,
            nftAddress,
          },
        })
      ).data;
      console.log("Old owner:", nftHolders[0].publicKey);
      console.log("New owner:", nftHolders[1].publicKey);
      console.log("NFT info:", info);
      assert.strictEqual(info?.nft.owner, nftHolders[1].publicKey);
    } catch (e: any) {
      if (soulBound) {
        console.log("Soul bound NFT, transfer failed as expected");
      } else {
        throw e;
      }
    }
    step = "transferred";
  });

  it(`should mint batch of NFTs`, async () => {
    assert.ok(collectionAddress, "collectionAddress should be defined");
    if (!collectionAddress) {
      throw new Error("NFT collection is not deployed");
    }
    assert.strictEqual(step, "transferred");
    console.log("Minting batch of NFTs...");
    console.log(
      "Batch NFT holders:",
      nftHolders.slice(0, 3).map((t) => t.publicKey)
    );
    const nonceData = (
      await api.getNonce({
        body: { address: creator.publicKey },
      })
    ).data;
    if (!nonceData) throw new Error("No nonce");
    console.log("Creator:", creator.publicKey);
    console.log("Creator nonce:", nonceData);
    let nonce = nonceData?.nonce;
    if (!nonce) throw new Error("No nonce");
    const BATCH_SIZE = 3;
    const hashes: string[] = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      const nftName = randomName();
      console.log(`Minting NFT ${nftName}...`);

      const tx = (
        await api.mintNft({
          body: {
            txType: "nft:mint",
            sender: creator.publicKey,
            nonce: nonce++, // IMPORTANT for batch minting
            collectionAddress,
            nftMintParams: {
              name: nftName,
              data: {
                owner: nftHolders[i].publicKey,
                canApprove: !soulBound,
                canTransfer: !soulBound,
                canChangeMetadata: false,
                canChangeMetadataVerificationKeyHash: false,
                canChangeName: false,
                canChangeOwnerByProof: false,
                canChangeStorage: false,
                canPause: true,
              },
              metadata: {
                name: nftName,
                image: randomImage(),
                description: randomText(),
                traits: [
                  {
                    key: "NFT Trait 1",
                    type: "string",
                    value: "NFT Value 1",
                  },
                  {
                    key: "NFT Trait 2",
                    type: "string",
                    value: "NFT private value 2",
                    isPrivate: true,
                  },
                ],
              },
            },
          },
        })
      ).data;
      if (!tx) throw new Error("No tx");
      const nftMintParams = (tx?.request as api.NftMintTransactionParams)
        .nftMintParams;
      const nftAddress = nftMintParams?.address;
      if (!nftAddress) throw new Error("NFT not minted");
      nftAddresses.push(nftAddress);
      console.log("NFT address:", nftAddress);
      console.log("Storage address:", tx?.storage);
      console.log("Metadata root:", tx?.metadataRoot);
      if (tx?.privateMetadata && collectionAddress && nftAddress) {
        await fs.writeFile(
          `./data/nft-${collectionAddress}-${nftAddress}.json`,
          tx.privateMetadata
        );
      }
      if (collectionAddress) {
        await fs.writeFile(
          `./data/nft-${collectionAddress}-${nftAddress}-keys.json`,
          JSON.stringify(
            {
              nftName,
              collectionName: tx?.collectionName,
              collectionAddress,
              nftAddress,
              nftContractPrivateKey: nftMintParams?.addressPrivateKey,
              storage: tx?.storage,
              metadataRoot: tx?.metadataRoot,
            },
            null,
            2
          )
        );
      }
      const proveTx = (
        await api.prove({
          body: {
            tx,
            signedData: JSON.stringify(
              client.signTransaction(
                tx.minaSignerPayload as any,
                creator.privateKey
              ).data
            ),
          },
        })
      ).data;

      if (!proveTx?.jobId) throw new Error("No jobId");

      const proofs = await api.waitForProofs(proveTx.jobId);
      assert.ok(proofs, "proofs should be defined");
      if (!proofs) throw new Error("No proofs");
      assert.strictEqual(proofs.length, 1);
      const hash = proofs[0];
      console.log("Minting NFT tx hash:", hash);
      assert.ok(hash, "hash should be defined");
      if (!hash) return;
      hashes.push(hash);
    }
    console.log("Waiting for batch of NFTs tx to be included in a block...");
    for (const hash of hashes) {
      await api.waitForTransaction(hash);
      const status = await api.txStatus({
        body: { hash },
      });
      console.log("Tx status:", hash, status?.data);
      assert.strictEqual(status?.data?.status, "applied");
    }
    await sleep(60000);
    for (const nftAddress of nftAddresses) {
      const info =
        // IMPORTANT to call it after the tx is included into block to get NFT indexed on https://devnet.minanft.io/
        (
          await api.getNftInfo({
            body: {
              collectionAddress,
              nftAddress,
            },
          })
        ).data;
      console.log("NFT info:", info);
    }

    step = "batchMint";
  });

  (soulBound ? it.skip : it)(`should sell batch of NFTs`, async () => {
    assert.ok(collectionAddress, "collectionAddress should be defined");
    if (!collectionAddress) {
      throw new Error("NFT collection is not deployed");
    }
    assert.strictEqual(step, "batchMint");
    console.log("Selling batch of NFTs...");
    console.log(
      "Batch NFT holders:",
      nftHolders.slice(0, 3).map((t) => t.publicKey)
    );
    const BATCH_SIZE = 2;
    const randomPrice = () => Math.floor(Math.random() * 10) * 10 + 10;
    const hashes: string[] = [];
    const prices = Array.from({ length: BATCH_SIZE }, randomPrice);
    for (let i = 0; i < BATCH_SIZE; i++) {
      const tx = (
        await api.sellNft({
          body: {
            txType: "nft:sell",
            sender: nftHolders[i].publicKey,
            collectionAddress,
            nftAddress: nftAddresses[i],
            nftSellParams: {
              price: prices[i],
            },
          },
        })
      ).data;
      if (!tx) throw new Error("No tx");
      const proveTx = (
        await api.prove({
          body: {
            tx,
            signedData: JSON.stringify(
              client.signTransaction(
                tx.minaSignerPayload as any,
                nftHolders[i].privateKey
              ).data
            ),
          },
        })
      ).data;

      if (!proveTx?.jobId) throw new Error("No jobId");

      const proofs = await api.waitForProofs(proveTx.jobId);
      assert.ok(proofs, "proofs should be defined");
      if (!proofs) throw new Error("No proofs");
      assert.strictEqual(proofs.length, 1);
      const hash = proofs[0];
      console.log("Selling NFT tx hash:", hash);
      assert.ok(hash, "hash should be defined");
      if (!hash) return;
      hashes.push(hash);
    }
    console.log("Waiting for batch of NFTs tx to be included in a block...");
    for (const hash of hashes) {
      await api.waitForTransaction(hash);
      const status = await api.txStatus({
        body: { hash },
      });
      console.log("Tx status:", hash, status?.data);
      assert.strictEqual(status?.data?.status, "applied");
    }
    await sleep(60000);
    for (const nftAddress of nftAddresses) {
      const info =
        // IMPORTANT to call it after the tx is included into block to get NFT indexed on https://devnet.minanft.io/
        (
          await api.getNftInfo({
            body: {
              collectionAddress,
              nftAddress,
            },
          })
        ).data;
      console.log("NFT info:", info);
    }

    step = "batchSell";
  });
});

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
