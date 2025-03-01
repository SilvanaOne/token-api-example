import { describe, expect, it } from "@jest/globals";
import Client from "mina-signer";
import * as api from "@silvana-one/api";
import { TEST_ACCOUNTS, API_KEY } from "../env.json";

type Chain = "zeko" | "devnet" | "mainnet";
const chain: Chain = "zeko" as Chain;
const bondingCurve = true as boolean;
const useWhitelists = false;

if (useWhitelists && bondingCurve)
  throw Error("Whitelists and bonding curve cannot be used together");

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

const exampleTokenAddress =
  chain === "zeko"
    ? "B62qnmnETnzpkEVvGQ6jE4PR3YVFY6ZEXxYXWvQPmxcZyJJtj9eGiD6"
    : "B62qn25cKc4ipqJMCDSMENgsiFwL49vTdnsDXgWWKWFXQaY819rn848";
const exampleJobId = "zkCWDYE3gAJOGRDqNlhke0u1NWVXlWgKS2uk2q0FgZdRbPoF";
const exampleFailedJobId = "zkCWvcg1BiPdLmsyxexOkrC3qZfx2UdLan0JB30cKDYVeSMB";
const exampleHash = "5JuEaWqCkiizzjA3mjrva5hjYeohiGKQFcffUdZxrEJM4xDirhK1";
const exampleNFTAddress =
  "B62qoT6jXebkJVmsUmxCxGJmvHJUXPNF417rms4PATi5R6Hw7e56CRt";
const exampleBalanceRequest = {
  tokenAddress: "B62qqXt9jJANADWZM4ovXx2bVRrMyjc26J9kCBnLVQMzqMNmmhVj7p4",
  address: TEST_ACCOUNTS[1].publicKey,
};
let offerAddress: string | undefined = undefined;
let bidAddress: string | undefined = undefined;

describe("MinaTokensAPI for Fungible Tokens", () => {
  let tokenAddress: string | undefined = undefined;

  const users = TEST_ACCOUNTS;
  const admin = users[0];
  const tokenHolders = users.slice(1);
  console.log("admin:", admin.publicKey);
  console.log(
    "Token holders:",
    tokenHolders.slice(0, 3).map((t) => t.publicKey)
  );

  const whitelist = useWhitelists
    ? [
        { address: tokenHolders[0].publicKey, amount: 1000_000_000_000 },
        { address: tokenHolders[1].publicKey, amount: 1000_000_000_000 },
        { address: tokenHolders[2].publicKey, amount: 1000_000_000_000 },
      ]
    : undefined;
  console.log("Whitelist:", whitelist);
  const tokenSymbol = bondingCurve ? "MEME" : "TEST";
  const tokenDecimals = 9;
  const uri = "https://minatokens.com";
  let step:
    | "started"
    | "deployed"
    | "minted"
    | "bid"
    | "sold"
    | "offered"
    | "bought"
    | "withdrawn"
    | "transferred"
    | "airdropped" = "started";

  it(`should get transaction status`, async () => {
    console.log("Getting existing transaction status...");
    const status = await api.txStatus({
      body: { hash: exampleHash },
    });
    expect(status?.data?.status).toBe("applied");
  });

  it(`should get contract info`, async () => {
    console.log("Getting existing contract info for", exampleTokenAddress);
    const info = await api.getContractInfo({
      body: {
        address: exampleTokenAddress,
      },
    });
    console.log(info?.data ? JSON.stringify(info.data, null, 2) : "No info");
  });

  it(`should get job result`, async () => {
    console.log("Getting existing job result...");
    const result = await api.getProof({
      body: { jobId: exampleJobId },
    });
    expect(result?.data?.jobStatus).toBe("used");
  });

  it(`should get failed job result`, async () => {
    console.log("Getting existing failed job result...");
    const result = await api.getProof({
      body: { jobId: exampleFailedJobId },
    });
    expect(result?.data?.jobStatus).toBe("failed");
  });

  it(`should get token balance`, async () => {
    console.log("Getting token balance...");
    const result = await api.getTokenBalance({
      body: {
        tokenAddress: "B62qouKMtMcUxabk72vwZS7tY3XYEca1CPKgXPfznCHUiVjP9E6xxQz",
        address: "B62qmoZqbXP3zRDFiVhczH6XXzHN2jhEq6dT9XqZ4trc1Y8oXyCAJgK",
      },
    });
    if (chain === "devnet") {
      expect(result?.data?.balance).toBe(940_000_000_000);
    } else {
      expect(result?.data?.balance).toBe(null);
    }
  });

  it(`should get existing token info`, async () => {
    console.log("Getting existing token info...");

    const tokenInfo = await api.getTokenInfo({
      body: {
        tokenAddress: exampleTokenAddress,
      },
    });
    console.log(tokenInfo?.data);
    expect(tokenInfo?.data?.tokenAddress).toBe(exampleTokenAddress);
  });

  it.skip(`should get existing NFT info`, async () => {
    console.log("Getting existing NFT info...");
    const nftInfo = await api.getNftV2Info({
      body: {
        collectionAddress:
          "B62qs2NthDuxAT94tTFg6MtuaP1gaBxTZyNv9D3uQiQciy1VsaimNFT",
        nftAddress: exampleNFTAddress,
      },
    });
    expect(nftInfo?.data?.contractAddress).toBe(
      "B62qs2NthDuxAT94tTFg6MtuaP1gaBxTZyNv9D3uQiQciy1VsaimNFT"
    );
    expect(nftInfo?.data?.nftAddress).toBe(exampleNFTAddress);
  });

  it.skip(`should call faucet`, async () => {
    const key = client.genKeys();
    console.log("Calling faucet for key:", key);
    const status = await api.faucet({
      body: { address: key.publicKey },
    });
    console.log(`Faucet response for ${key.publicKey}:`, status);
  });

  it(`should deploy token`, async () => {
    console.log("Deploying new token...");
    console.log("Admin address:", admin.publicKey);

    const adminContract = bondingCurve
      ? "bondingCurve"
      : useWhitelists
      ? "advanced"
      : "standard";

    console.log("Admin contract:", adminContract);
    console.log("Sender:", admin.publicKey);

    const tx = (
      await api.launchToken({
        body: {
          adminContract,
          sender: admin.publicKey,
          symbol: tokenSymbol,
          decimals: tokenDecimals,
          uri,
          whitelist: useWhitelists ? whitelist : undefined,
          canMint: "whitelist",
        },
      })
    ).data;
    if (!tx) throw new Error("Token not deployed");

    const { minaSignerPayload } = tx;
    if (!tx.request || !("adminContractAddress" in tx.request))
      throw new Error("Token not deployed");
    const adminContractAddress = tx?.request?.adminContractAddress;
    tokenAddress = tx?.request?.tokenAddress;
    if (!tokenAddress) throw new Error("Token not deployed");
    console.log("Token address:", tokenAddress);
    console.log("Admin contract address:", adminContractAddress);

    const proveTx = (
      await api.prove({
        body: {
          tx,
          signedData: JSON.stringify(
            client.signTransaction(minaSignerPayload as any, admin.privateKey)
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
    await new Promise((resolve) => setTimeout(resolve, 10000));
    const tokenInfo = await api.getTokenInfo({
      body: { tokenAddress },
    });
    console.log(tokenInfo?.data);
    step = "deployed";
  });

  it(`should mint token`, async () => {
    expect(tokenAddress).toBeDefined();
    if (!tokenAddress) {
      throw new Error("Token not deployed");
    }
    expect(step).toBe("deployed");

    console.log("Building mint transaction...");

    const tx = (
      await api.mintTokens({
        body: {
          sender: admin.publicKey,
          tokenAddress,
          to: tokenHolders[0].publicKey,
          amount: 1_000_000_000_000 + (bondingCurve ? 300_000_000_000_000 : 0),
          price: bondingCurve ? 10_000 : undefined,
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
              admin.privateKey
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
    const tokenInfo = await api.getTokenInfo({
      body: { tokenAddress },
    });
    console.log(tokenInfo?.data);
    step = "minted";
    const balance = (
      await api.getTokenBalance({
        body: {
          tokenAddress,
          address: tokenHolders[0].publicKey,
        },
      })
    ).data;
    console.log(`Balance of token holder 0:`, balance);
    expect(balance?.balance).toBe(
      1_000_000_000_000 + (bondingCurve ? 300_000_000_000_000 : 0)
    );
  });

  if (bondingCurve) {
    it(`should redeem token`, async () => {
      expect(tokenAddress).toBeDefined();
      if (!tokenAddress) {
        throw new Error("Token not deployed");
      }
      expect(step).toBe("minted");
      await new Promise((resolve) => setTimeout(resolve, 30000));

      console.log("Building redeem transaction...");

      const tx = (
        await api.redeemTokens({
          body: {
            sender: tokenHolders[0].publicKey,
            tokenAddress,
            amount: 300_000_000_000_000,
            price: 9_000,
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
                tokenHolders[0].privateKey
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
      const tokenInfo = await api.getTokenInfo({
        body: { tokenAddress },
      });
      console.log(tokenInfo?.data);
      const balance = (
        await api.getTokenBalance({
          body: {
            tokenAddress,
            address: tokenHolders[0].publicKey,
          },
        })
      ).data;
      console.log(`Balance of token holder 0:`, balance);
      expect(balance?.balance).toBe(1000_000_000_000);
    });
  }

  it(`should bid`, async () => {
    expect(tokenAddress).toBeDefined();
    if (!tokenAddress) {
      throw new Error("Token not deployed");
    }
    expect(step).toBe("minted");

    console.log("Building bid transaction...");

    const tx = (
      await api.tokenBid({
        body: {
          sender: tokenHolders[4].publicKey,
          tokenAddress,
          amount: 100_000_000_000,
          price: 100_000_000,
          whitelist: useWhitelists ? whitelist : undefined,
        },
      })
    ).data;
    if (!tx) throw new Error("No tx");
    if (!tx.request || !("bidAddress" in tx.request))
      throw new Error("Token not bid");
    bidAddress = tx.request.bidAddress;
    if (!bidAddress) throw new Error("Token not bid");

    const proveTx = (
      await api.prove({
        body: {
          tx,
          signedData: JSON.stringify(
            client.signTransaction(
              tx.minaSignerPayload as any,
              tokenHolders[4].privateKey
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
    console.log("Bid contract address:", bidAddress);
    step = "bid";
    const balance = (
      await api.getTokenBalance({
        body: {
          address: bidAddress,
        },
      })
    ).data;
    console.log(`Balance of ${bidAddress}:`, balance);
    expect(balance?.balance).toBe(10_000_000_000);
  });

  it(`should sell token`, async () => {
    expect(tokenAddress).toBeDefined();
    if (!tokenAddress) {
      throw new Error("Token not deployed");
    }
    if (!bidAddress) {
      throw new Error("Token not bid");
    }
    expect(step).toBe("bid");

    console.log("Building sell transaction...");

    const tx = (
      await api.sellTokens({
        body: {
          sender: tokenHolders[0].publicKey,
          tokenAddress,
          bidAddress,
          amount: 5_000_000_000,
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
              tokenHolders[0].privateKey
            ).data
          ),
        },
      })
    ).data;
    if (!proveTx) throw new Error("No proveTx");
    if (!proveTx.jobId) throw new Error("No jobId");
    const proofs = await api.waitForProofs(proveTx.jobId);
    expect(proofs).toBeDefined();
    if (!proofs) throw new Error("No proofs");
    expect(proofs.length).toBe(1);
    const hash = proofs[0];
    expect(hash).toBeDefined();
    if (!hash) return;
    await api.waitForTransaction(hash);
    step = "sold";
    const balance = (
      await api.getTokenBalance({
        body: {
          tokenAddress,
          address: tokenHolders[0].publicKey,
        },
      })
    ).data;
    console.log(`Balance of seller:`, balance);
    const balanceBuyer = (
      await api.getTokenBalance({
        body: {
          tokenAddress,
          address: tokenHolders[4].publicKey,
        },
      })
    ).data;
    console.log(`Balance of buyer:`, balanceBuyer);
    expect(balance?.balance).toBe(995_000_000_000);
    expect(balanceBuyer?.balance).toBe(5_000_000_000);
  });

  it(`should offer token for sale`, async () => {
    expect(tokenAddress).toBeDefined();
    if (!tokenAddress) {
      throw new Error("Token not deployed");
    }
    expect(step).toBe("sold");

    console.log("Building offer transaction...");

    const tx = (
      await api.tokenOffer({
        body: {
          sender: tokenHolders[0].publicKey,
          tokenAddress,
          amount: 500_000_000_000,
          price: 10_000_000_000,
          whitelist: useWhitelists ? whitelist : undefined,
        },
      })
    ).data;
    if (!tx) throw new Error("No tx");
    if (!tx.request || !("offerAddress" in tx.request))
      throw new Error("Token not offered");
    offerAddress = tx.request.offerAddress;
    if (!offerAddress) throw new Error("Token not offered");

    const proveTx = (
      await api.prove({
        body: {
          tx,
          signedData: JSON.stringify(
            client.signTransaction(
              tx.minaSignerPayload as any,
              tokenHolders[0].privateKey
            ).data
          ),
        },
      })
    ).data;
    if (!proveTx) throw new Error("No proveTx");
    if (!proveTx.jobId) throw new Error("No jobId");
    const proofs = await api.waitForProofs(proveTx.jobId);
    expect(proofs).toBeDefined();
    if (!proofs) throw new Error("No proofs");
    expect(proofs.length).toBe(1);
    const hash = proofs[0];
    expect(hash).toBeDefined();
    if (!hash) return;
    await api.waitForTransaction(hash);
    const tokenInfo = await api.getTokenInfo({
      body: { tokenAddress },
    });
    console.log(tokenInfo?.data);
    console.log("Offer contract address:", offerAddress);
    step = "offered";
    const balance = (
      await api.getTokenBalance({
        body: {
          tokenAddress,
          address: tokenHolders[0].publicKey,
        },
      })
    ).data;
    console.log(`Balance of ${tokenHolders[0].publicKey}:`, balance);
    expect(balance?.balance).toBe(495_000_000_000);
    const balanceOffer = (
      await api.getTokenBalance({
        body: {
          tokenAddress,
          address: offerAddress,
        },
      })
    ).data;
    console.log(`Balance of offer ${offerAddress}:`, balanceOffer);
    expect(balanceOffer?.balance).toBe(500_000_000_000);
  });

  it(`should buy token`, async () => {
    expect(tokenAddress).toBeDefined();
    if (!tokenAddress) {
      throw new Error("Token not deployed");
    }
    if (!offerAddress) {
      throw new Error("Token not offered");
    }
    expect(step).toBe("offered");
    const balanceBefore = (
      await api.getTokenBalance({
        body: {
          address: tokenHolders[1].publicKey,
        },
      })
    ).data;
    console.log(
      `Balance of ${tokenHolders[1].publicKey} in MINA:`,
      (balanceBefore?.balance ?? 0) / 1_000_000_000
    );

    console.log("Building buy transaction...");

    const tx = (
      await api.buyTokens({
        body: {
          sender: tokenHolders[1].publicKey,
          tokenAddress,
          offerAddress,
          amount: 10_000_000_000,
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
              tokenHolders[1].privateKey
            ).data
          ),
        },
      })
    ).data;
    if (!proveTx) throw new Error("No proveTx");
    if (!proveTx.jobId) throw new Error("No jobId");
    const proofs = await api.waitForProofs(proveTx.jobId);
    expect(proofs).toBeDefined();
    if (!proofs) throw new Error("No proofs");
    expect(proofs.length).toBe(1);
    const hash = proofs[0];
    expect(hash).toBeDefined();
    if (!hash) return;
    await api.waitForTransaction(hash);
    const tokenInfo = await api.getTokenInfo({
      body: { tokenAddress },
    });
    console.log(tokenInfo?.data);
    step = "bought";
    const balance = (
      await api.getTokenBalance({
        body: {
          tokenAddress,
          address: tokenHolders[1].publicKey,
        },
      })
    ).data;
    console.log(`Balance of buyer:`, balance);
    const balanceOffer = (
      await api.getTokenBalance({
        body: {
          tokenAddress,
          address: offerAddress,
        },
      })
    ).data;
    expect(balance?.balance).toBe(10_000_000_000);
    console.log(`Balance of offer:`, balanceOffer);
    expect(balanceOffer?.balance).toBe(490_000_000_000);
    const balanceAfter = (
      await api.getTokenBalance({
        body: {
          address: tokenHolders[1].publicKey,
        },
      })
    ).data;
    console.log(
      `Balance of ${tokenHolders[1].publicKey} in MINA:`,
      (balanceAfter?.balance ?? 0) / 1_000_000_000
    );
    console.log(
      `Balance difference:`,
      ((balanceAfter?.balance ?? 0) - (balanceBefore?.balance ?? 0)) /
        1_000_000_000
    );
  });

  it(`should withdraw token`, async () => {
    expect(tokenAddress).toBeDefined();
    if (!tokenAddress) {
      throw new Error("Token not deployed");
    }
    if (!offerAddress) {
      throw new Error("Token not offered");
    }
    expect(step).toBe("bought");

    console.log("Building withdraw transaction...");

    const tx = (
      await api.withdrawTokenOffer({
        body: {
          sender: tokenHolders[0].publicKey,
          tokenAddress,
          offerAddress,
          amount: 490_000_000_000,
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
              tokenHolders[0].privateKey
            ).data
          ),
        },
      })
    ).data;
    if (!proveTx) throw new Error("No proveTx");
    if (!proveTx.jobId) throw new Error("No jobId");
    const proofs = await api.waitForProofs(proveTx.jobId);
    expect(proofs).toBeDefined();
    if (!proofs) throw new Error("No proofs");
    expect(proofs.length).toBe(1);
    const hash = proofs[0];
    expect(hash).toBeDefined();
    if (!hash) return;
    await api.waitForTransaction(hash);
    const tokenInfo = await api.getTokenInfo({
      body: { tokenAddress },
    });
    console.log(tokenInfo?.data);
    step = "withdrawn";
    const balance = (
      await api.getTokenBalance({
        body: {
          tokenAddress,
          address: tokenHolders[0].publicKey,
        },
      })
    ).data;
    console.log(`Balance of token holder 0:`, balance);
    expect(balance?.balance).toBe(985_000_000_000);
    const balanceOffer = (
      await api.getTokenBalance({
        body: {
          tokenAddress,
          address: offerAddress,
        },
      })
    ).data;
    console.log(`Balance of offer:`, balanceOffer);
    expect(balanceOffer?.balance).toBe(0);
  });

  it(`should transfer token`, async () => {
    expect(tokenAddress).toBeDefined();
    if (!tokenAddress) {
      throw new Error("Token not deployed");
    }
    expect(step).toBe("withdrawn");

    console.log("Building transfer transaction...");

    const tx = (
      await api.transferTokens({
        body: {
          sender: tokenHolders[0].publicKey,
          tokenAddress,
          to: tokenHolders[2].publicKey,
          amount: 50_000_000_000,
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
              tokenHolders[0].privateKey
            ).data
          ),
        },
      })
    ).data;
    if (!proveTx) throw new Error("No proveTx");
    if (!proveTx.jobId) throw new Error("No jobId");
    const proofs = await api.waitForProofs(proveTx.jobId);
    expect(proofs).toBeDefined();
    if (!proofs) throw new Error("No proofs");
    expect(proofs.length).toBe(1);
    const hash = proofs[0];
    expect(hash).toBeDefined();
    if (!hash) return;
    await api.waitForTransaction(hash);
    const tokenInfo = await api.getTokenInfo({
      body: { tokenAddress },
    });
    console.log(tokenInfo?.data);
    step = "transferred";
    const balance = (
      await api.getTokenBalance({
        body: {
          tokenAddress,
          address: tokenHolders[0].publicKey,
        },
      })
    ).data;
    console.log(`Balance of token holder 0:`, balance);
    expect(balance?.balance).toBe(935_000_000_000);
    const balanceTransfer = (
      await api.getTokenBalance({
        body: {
          tokenAddress,
          address: tokenHolders[2].publicKey,
        },
      })
    ).data;
    console.log(`Balance of token holder 2:`, balanceTransfer);
    expect(balanceTransfer?.balance).toBe(50_000_000_000);
  });

  it(`should airdrop token`, async () => {
    expect(tokenAddress).toBeDefined();
    if (!tokenAddress) {
      throw new Error("Token not deployed");
    }
    expect(step).toBe("transferred");

    console.log("Building airdrop transaction...");

    const recipients = [1, 2, 3].map((i) => ({
      address: client.genKeys().publicKey,
      amount: 10_000_000_000,
    }));

    const airdrop = (
      await api.airdropTokens({
        body: {
          sender: tokenHolders[0].publicKey,
          tokenAddress,
          recipients,
        },
      })
    ).data;
    if (!airdrop) throw new Error("No airdrop");
    if (!airdrop.txs) throw new Error("No txs");

    const proveTx = (
      await api.prove({
        body: {
          txs: airdrop.txs.map((tx) => ({
            tx,
            signedData: JSON.stringify(
              client.signTransaction(
                tx.minaSignerPayload as any,
                tokenHolders[0].privateKey
              ).data
            ),
          })),
        },
      })
    ).data;
    if (!proveTx) throw new Error("No proveTx");
    if (!proveTx.jobId) throw new Error("No jobId");
    const proofs = await api.waitForProofs(proveTx.jobId);
    expect(proofs).toBeDefined();
    if (!proofs) throw new Error("No proofs");
    expect(proofs.length).toBe(3);
    for (const hash of proofs) {
      expect(hash).toBeDefined();
      if (!hash) return;
      await api.waitForTransaction(hash);
    }
    const tokenInfo = await api.getTokenInfo({
      body: { tokenAddress },
    });
    console.log(tokenInfo?.data);
    step = "airdropped";
    const balance = (
      await api.getTokenBalance({
        body: {
          tokenAddress,
          address: tokenHolders[0].publicKey,
        },
      })
    ).data;
    console.log(`Balance of token holder 0:`, balance);
    expect(balance?.balance).toBe(905_000_000_000);
  });
});
