import { config } from 'dotenv';
import * as fs from 'fs';
import * as fspath from 'path';

import { createWalletClient, createPublicClient, encodeFunctionData, Abi, Address, http, fallback, formatUnits } from 'viem';
import { arbitrum } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

import {getTokenBalance,queryNoSplitAbi} from './client'

// Load environment variables from .env file
config();

const providerUrl = process.env.ARB_RPC as string;
const routerAddress = process.env.CAMELOT_ROUTER as Address;
const eclipPair = (process.env.ECLIP_PAIR || "").split(",") as Address[];
const tiaPair = (process.env.TIA_PAIR || "").split(",") as Address[];
const tiaArbAddress = process.env.TIA_ARB as Address;
const eclipArbAddress = process.env.ECLIP_ARB as Address;
const arb_exp = process.env.ARB_EXP;

if (!providerUrl || !routerAddress) {
  throw new Error("Please ensure ARB_RPC and CAMELOT_ROUTER are set in your .env file");
}

if (!eclipPair.length || !tiaPair.length) {
  throw new Error("Please ensure ECLIP_PAIR and TIA_PAIR are set correctly in your .env file");
}

// Define the interface for the swap trade
interface SwapTrade {
  amountIn: bigint;
  amountOut: bigint;
  path: Address[];
  adapters: Address[];
  recipients: Address[];
}

// Define the interface for the swap parameters
interface SwapParams {
  trade: SwapTrade;
  fee: bigint;
  to: Address;
}

// Create a function to get the best amountOut
async function getBestAmountOut(
  client: any, 
  contractAddress: Address, 
  amountIn: bigint, 
  tokenIn: Address, 
  tokenOut: Address
): Promise<bigint> {
  const result = await client.readContract({
    address: contractAddress,
    abi: queryNoSplitAbi,
    functionName: 'queryNoSplit',
    args: [amountIn, tokenIn, tokenOut],
  });

  return BigInt(result.amountOut);
}

// Create a function to perform the swap
export async function swapNoSplitFromETH(
  privateKey: `0x${string}`,
  maxPayEth: bigint,
  path: Address[],
  contractAddress: Address,
  adapters: Address[],
  recipients: Address[],
  nonce: number
) {
  // Generate a random amountIn not greater than maxPayEth
  const amountIn = BigInt(Math.floor(Math.random() * Number(maxPayEth))) + 1n;

  // Initialize wallet client
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: arbitrum,
    transport: fallback([http(providerUrl)], {
      rank: {
        interval: 60_000,
        sampleCount: 5,
        timeout: 500,
        weights: {
          latency: 0.3,
          stability: 0.7
        }
      }
    }),
  });

  // Initialize public client for reading contract data
  const publicClient = createPublicClient({
    chain: arbitrum,
    transport: fallback([http(providerUrl)], {
      rank: {
        interval: 60_000,
        sampleCount: 5,
        timeout: 500,
        weights: {
          latency: 0.3,
          stability: 0.7
        }
      }
    }),
  });

  // Calculate amountOut using queryNoSplit
  const amountOut = await getBestAmountOut(publicClient, contractAddress, amountIn, path[0], path[1]);

  // Define swap parameters
  const swapParams: SwapParams = {
    trade: {
      amountIn,
      amountOut,
      path,
      adapters,
      recipients
    },
    fee: 0n,
    to: account.address as Address
  };

  // ABI for the swap function
  const abi: Abi = [
    {
      "inputs": [
        {
          "components": [
            { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
            { "internalType": "uint256", "name": "amountOut", "type": "uint256" },
            { "internalType": "address[]", "name": "path", "type": "address[]" },
            { "internalType": "address[]", "name": "adapters", "type": "address[]" },
            { "internalType": "address[]", "name": "recipients", "type": "address[]" },
          ],
          "internalType": "struct SwapTrade",
          "name": "_trade",
          "type": "tuple",
        },
        { "internalType": "uint256", "name": "_fee", "type": "uint256" },
        { "internalType": "address", "name": "_to", "type": "address" }
      ],
      "name": "swapNoSplitFromETH",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    }
  ];

  // Encode function data
  const swapData = encodeFunctionData({
    abi,
    functionName: 'swapNoSplitFromETH',
    args: [
      swapParams.trade,
      swapParams.fee,
      swapParams.to
    ]
  });

  // Perform the swap transaction
  const txHash = await walletClient.sendTransaction({
    account,
    to: contractAddress,
    value: swapParams.trade.amountIn,
    data: swapData,
    nonce  // Provide the nonce here
  });

  const formattedAmountIn = Number(formatUnits(swapParams.trade.amountIn, 18));
  const formattedAmountOut = Number(formatUnits(swapParams.trade.amountOut, 6));

  console.log(`🚀 Successfully swapped ${formattedAmountIn} ETH for ${formattedAmountOut} tokens for account ${account.address}`);
  console.log(arb_exp + txHash);

  // Fetch and return balances of TIA_ARB and ECLIP_ARB
  const tiaBalance = await getTokenBalance(publicClient, tiaArbAddress, account.address);
  const eclipBalance = await getTokenBalance(publicClient, eclipArbAddress, account.address);

  // Record balances in coins.json
  const coinsFilePath = fspath.resolve('./data/coins.json');
  let coinsData: any[] = [];
  try {
    if (fs.existsSync(coinsFilePath)) {
      const fileContent = fs.readFileSync(coinsFilePath, 'utf8');
      if (fileContent) {
        coinsData = JSON.parse(fileContent);
      }
    }
  } catch (error) {
    console.error("Failed to read or parse coins.json:", error);
  }

  // Update the balances for the current account
  let accountData = coinsData.find((item: any) => item.address === account.address);
  if (!accountData) {
    accountData = { address: account.address };
    coinsData.push(accountData);
  }
  accountData.TIA_ARB = tiaBalance.toString();
  accountData.ECLIP_ARB = eclipBalance.toString();

  // Write the updated balances to coins.json
  fs.writeFileSync(coinsFilePath, JSON.stringify(coinsData, null, 2));
}
