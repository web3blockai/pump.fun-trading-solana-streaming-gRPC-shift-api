import Client, {
    CommitmentLevel,
    SubscribeRequestAccountsDataSlice,
    SubscribeRequestFilterAccounts,
    SubscribeRequestFilterBlocks,
    SubscribeRequestFilterBlocksMeta,
    SubscribeRequestFilterEntry,
    SubscribeRequestFilterSlots,
    SubscribeRequestFilterTransactions,
  } from "@triton-one/yellowstone-grpc";
  import { SubscribeRequestPing } from "@triton-one/yellowstone-grpc/dist/grpc/geyser";
  import { VersionedTransactionResponse } from "@solana/web3.js";
  import { tOutPut } from "./utils/transactionOutput";
  //import { searchForInitialize2 } from "./utils/logTXN";
  import * as fs from "fs";
  import * as path from "path";
  import { format } from "date-fns";

  interface SubscribeRequest {
    accounts: { [key: string]: SubscribeRequestFilterAccounts };
    slots: { [key: string]: SubscribeRequestFilterSlots };
    transactions: { [key: string]: SubscribeRequestFilterTransactions };
    transactionsStatus: { [key: string]: SubscribeRequestFilterTransactions };
    blocks: { [key: string]: SubscribeRequestFilterBlocks };
    blocksMeta: { [key: string]: SubscribeRequestFilterBlocksMeta };
    entry: { [key: string]: SubscribeRequestFilterEntry };
    commitment?: CommitmentLevel | undefined;
    accountsDataSlice: SubscribeRequestAccountsDataSlice[];
    ping?: SubscribeRequestPing | undefined;
  }

  const CSV_FILE_PATH = path.join(__dirname, "transactions2.csv");

  const MIGRATION = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';

  let tokens = [
    "4ErEf2K3gju6JJCv3sqQGWQ5ZF5qZAS1Vd2w2j58pump",
//    "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
  ];

  const token2 = ''
  let token_update = 0;

  // Add token2 after 30 seconds
  /*setTimeout(() => {
    tokens.push(token2);
    console.log("Added token2 to monitoring:", token2);
    token_update = 1;

  }, 30000);*/

  // Ensure CSV file has headers
  if (!fs.existsSync(CSV_FILE_PATH)) {
    fs.writeFileSync(CSV_FILE_PATH, "baseaddress,datetime,signature,baseamount,solamount,priceinsol\n");
  }

    async function handleStream(client: Client, args: SubscribeRequest) {
    // Subscribe for events
    const stream = await client.subscribe();

    // Create `error` / `end` handler
    const streamClosed = new Promise<void>((resolve, reject) => {
      stream.on("error", (error) => {
        console.log("ERROR", error);
        reject(error);
        stream.end();
      });
      stream.on("end", () => {
        resolve();
      });
      stream.on("close", () => {
        resolve();
      });
    });

    setInterval(() => {
      //console.log("\n/// Token update:", token_update);
      if (token_update === 1) {
        // Writing the updated data to the stream
        stream.write(args, (err: any) => {
          if (err) {
            console.error("Error during write:", err);
          } else {
            console.log("Write succeeded");
          }
        });

        // Reset token_update if necessary to prevent repeated writes
        token_update = 0;
      }
    }, 3000); // Check every 3 seconds

    // Handle updates
    stream.on("data", async (data) => {
      try {
        //console.log("\n")
        //console.log(JSON.stringify(data, null, 2)); // Log full transaction details
        const result = tOutPut(data);
        //const migratedTXN = searchForInitialize2(result);
        if (!result) return;
        //console.log("Txn detected");
        const signature = result.signature
        console.log("Transaction detected:", signature);
        //console.log(JSON.stringify(result, null, 2)); // Log full transaction details

        const baseAddress = req.transactions.swaps.accountInclude[0]
        const accountIncludeMint = [baseAddress, 'So11111111111111111111111111111111111111112'];

        const preTokenBalances = result?.meta?.preTokenBalances || [];
        const postTokenBalances = result?.meta?.postTokenBalances || [];

        const owner = postTokenBalances.find(balance => balance.mint === baseAddress)?.owner || "";

        const filteredPreBalances = preTokenBalances.filter(
          balance => balance.owner === "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1" && accountIncludeMint.includes(balance.mint)
        );
        const filteredPostBalances = postTokenBalances.filter(
          balance => balance.owner === "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1" && accountIncludeMint.includes(balance.mint)
        );


        filteredPreBalances.forEach(balance => {
          console.log(`Account Index: ${balance.accountIndex}`);
          console.log(`Mint: ${balance.mint}`);
          console.log(`Owner: ${balance.owner}`);
          console.log(`Program ID: ${balance.programId}`);
          console.log(`UI Token Amount: ${balance.uiTokenAmount.uiAmount}`);
        });

        filteredPostBalances.forEach(balance => {
          console.log(`Account Index: ${balance.accountIndex}`);
          console.log(`Mint: ${balance.mint}`);
          console.log(`Owner: ${balance.owner}`);
          console.log(`Program ID: ${balance.programId}`);
          console.log(`UI Token Amount: ${balance.uiTokenAmount.uiAmount}`);
        });

        // Balances are those of the exchanges; ie if the balance of the base token decreases, it means the exchange sold the base token for the quote token and vice-versa
        const basePreBalance = filteredPreBalances.find(balance => balance.mint === baseAddress) || { uiTokenAmount: { uiAmount: 0 } };
        const solPreBalance = filteredPreBalances.find(balance => balance.mint === "So11111111111111111111111111111111111111112") || { uiTokenAmount: { uiAmount: 0 } };

        console.log("\nBase Pre Balance:", basePreBalance);
        console.log("SOL Pre Balance:", solPreBalance);

        if (basePreBalance.uiTokenAmount.uiAmount == 0 || solPreBalance.uiTokenAmount.uiAmount == 0) {
          console.log("Transaction ignored: Missing pre-token balances for base or SOL token.");

          return;
        }

        const basePostBalance = filteredPostBalances.find(balance => balance.accountIndex === basePreBalance.accountIndex) || { uiTokenAmount: { uiAmount: 0 } };
        const solPostBalance = filteredPostBalances.find(balance => balance.accountIndex === solPreBalance.accountIndex) || { uiTokenAmount: { uiAmount: 0 } };

        console.log("\nBase Post Balance:", basePostBalance);
        console.log("SOL Post Balance:", solPostBalance);

        if (basePostBalance.uiTokenAmount.uiAmount == 0 || solPostBalance.uiTokenAmount.uiAmount == 0) {
          console.log("Transaction ignored: Missing post-token balances for base or SOL token.");

          return;
        }

        const baseAmount = basePostBalance && basePreBalance
        ? parseFloat(basePostBalance.uiTokenAmount.uiAmount) - parseFloat(basePreBalance.uiTokenAmount.uiAmount)
        : 0;
        const solAmount = solPostBalance && solPreBalance
        ? parseFloat(solPostBalance.uiTokenAmount.uiAmount) - parseFloat(solPreBalance.uiTokenAmount.uiAmount)
        : 0;

        if (baseAmount < 0) {
          console.log("Swapped SOL for base token.");
        } else {
          console.log("Swapped base token for SOL.");
        }

        console.log("\nBase Amount:", baseAmount);
        console.log("SOL Amount:", solAmount);

        let priceInSol = 0;
        if (baseAmount !== 0 && solAmount !== 0) {
          priceInSol = (Math.abs(solAmount) / Math.abs(baseAmount));
          console.log(`Price calculated: ${priceInSol} SOL`);
        } else {
          console.log("No valid amounts for calculation.");
        }

        // Save to CSV
        const datetime = format(new Date(), "yyyy-MM-dd HH:mm:ss");
        const csvLine = `${baseAddress},${datetime},${signature},${owner},${baseAmount},${solAmount},${priceInSol}\n`;
        fs.appendFileSync(CSV_FILE_PATH, csvLine);

      } catch (error) {
        console.log("Error processing transaction:", error);
      }
    });

    // Send subscribe request
    await new Promise<void>((resolve, reject) => {
      stream.write(args, (err: any) => {
        if (err === null || err === undefined) {
          resolve();
        } else {
          reject(err);
        }
      });
    }).catch((reason) => {
      console.error(reason);
      throw reason;
    });

    await streamClosed;
  }

  async function subscribeCommand(client: Client, args: SubscribeRequest) {
    while (true) {
      try {
        await handleStream(client, args);
      } catch (error) {
        console.error("Stream error, restarting in 1 second...", error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }
  const client = new Client(
    'https://grpc.us.shyft.to',
    '7ac80f3c-18bb-48c4-b021-16d2047e8d31',
    undefined,
  );
  const req = {
    accounts: {},
    slots: {},
    transactions: {
      swaps: {
        vote: false,
        failed: false,
        signature: undefined,
        accountInclude: tokens,
        accountExclude: [],
        accountRequired: [],
      },
    },
    transactionsStatus: {},
    entry: {},
    blocks: {},
    blocksMeta: {},
    accountsDataSlice: [],
    ping: undefined,
    commitment: CommitmentLevel.PROCESSED, //for receiving confirmed txn updates
  };
  subscribeCommand(client, req);

