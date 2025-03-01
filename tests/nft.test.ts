import { describe, expect, it } from "@jest/globals";
import Client from "mina-signer";
import * as api from "@silvana-one/api";
import { TEST_ACCOUNTS, API_KEY } from "../env.json";
import {
  randomName,
  randomText,
  randomImage,
  randomBanner,
} from "../src/random";
import fs from "fs/promises";

/*
Frontend: https://devnet.minanft.io/
API: https://docs.zkcloudworker.com/OpenAPI/launch-nft-collection
*/

type Chain = "zeko" | "devnet" | "mainnet";
const chain: Chain = "devnet" as Chain;
const soulBound = false as boolean;

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
    ? "B62qnmnETnzpkEVvGQ6jE4PR3YVFY6ZEXxYXWvQPmxcZyJJtj9eGiD6"
    : "B62qn25cKc4ipqJMCDSMENgsiFwL49vTdnsDXgWWKWFXQaY819rn848";

describe("MinaTokensAPI for NFT", () => {
  let collectionAddress: string | undefined = undefined;
  let nftAddress: string | undefined = undefined;
  const users = TEST_ACCOUNTS;
  const creator = users[0];
  const nftHolders = users.slice(1);

  let step: "started" | "launched" | "minted" | "transferred" | "batch" =
    "started";

  it(`should get NFT info`, async () => {
    const info = (
      await api.getNftInfo({
        body: {
          nftAddress: "B62qiwSqsfS8jGszg6HfGBzSe2CuQbnqGBVJcSvQncUJJrJSVwvMD8x",
          collectionAddress:
            "B62qrfuCkQpEJxgLnACWAp7q2hMVYgneQn8FHMt23JUX87rjXjVuyyK",
          // "B62qjRPTy8u1WmqvesxC6VhixvwCzCAFjDjmMwm1LB5viEDTfAWbfz9",
        },
      })
    ).data;
    console.log("NFT info:", info);
  });
  return;

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
    expect(proofs).toBeDefined();
    if (!proofs) throw new Error("No proofs");
    expect(proofs.length).toBe(1);
    const hash = proofs[0];
    expect(hash).toBeDefined();
    if (!hash) throw new Error("No hash");
    await api.waitForTransaction(hash);
    await new Promise((resolve) => setTimeout(resolve, 30000));
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
    expect(collectionAddress).toBeDefined();
    if (!collectionAddress) {
      throw new Error("NFT collection is not deployed");
    }
    expect(step).toBe("launched");
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
    expect(proofs).toBeDefined();
    if (!proofs) throw new Error("No proofs");
    expect(proofs.length).toBe(1);
    const hash = proofs[0];
    expect(hash).toBeDefined();
    if (!hash) return;
    await api.waitForTransaction(hash);
    await new Promise((resolve) => setTimeout(resolve, 30000));
    const status = await api.txStatus({
      body: { hash },
    });
    console.log("Tx status:", hash, status?.data);
    expect(status?.data?.status).toBe("applied");
    const info = (
      await api.getNftInfo({
        body: {
          collectionAddress,
          nftAddress,
        },
      })
    ).data;
    console.log("NFT info:", info);
    expect(info?.nft.owner).toBe(creator.publicKey);
    step = "minted";
  });

  it(`should transfer NFT`, async () => {
    expect(collectionAddress).toBeDefined();
    if (!collectionAddress) {
      throw new Error("NFT collection is not deployed");
    }
    if (!nftAddress) {
      throw new Error("NFT is not minted");
    }
    expect(step).toBe("minted");
    console.log(`Transferring NFT...`);

    try {
      const tx = (
        await api.transferNft({
          body: {
            txType: "nft:transfer",
            sender: creator.publicKey,
            collectionAddress,
            nftAddress,
            nftTransferParams: {
              from: creator.publicKey,
              to: nftHolders[0].publicKey,
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
      expect(proofs).toBeDefined();
      if (!proofs) throw new Error("No proofs");
      expect(proofs.length).toBe(1);
      const hash = proofs[0];
      expect(hash).toBeDefined();
      if (!hash) return;
      await api.waitForTransaction(hash);
      await new Promise((resolve) => setTimeout(resolve, 30000));
      const status = await api.txStatus({
        body: { hash },
      });
      console.log("Tx status:", hash, status?.data);
      expect(status?.data?.status).toBe("applied");
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
      expect(info?.nft.owner).toBe(nftHolders[0].publicKey);
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
    expect(collectionAddress).toBeDefined();
    if (!collectionAddress) {
      throw new Error("NFT collection is not deployed");
    }
    expect(step).toBe("transferred");
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
    const nftAddresses: string[] = [];
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
      expect(proofs).toBeDefined();
      if (!proofs) throw new Error("No proofs");
      expect(proofs.length).toBe(1);
      const hash = proofs[0];
      console.log("Minting NFT tx hash:", hash);
      expect(hash).toBeDefined();
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
      expect(status?.data?.status).toBe("applied");
    }
    await new Promise((resolve) => setTimeout(resolve, 60000));
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

    step = "batch";
  });
});
