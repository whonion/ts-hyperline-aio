import { config } from 'dotenv';
import { createWalletClient, createPublicClient, encodeFunctionData, parseEther, Abi, Address, http, fallback } from 'viem';
import { arbitrum } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Load environment variables from .env file
config();

const providerUrl = process.env.ARB_RPC as string;
const privateKey = process.env.YOUR_PRIVATE_KEY as `0x${string}`;
const routerAddress = process.env.CAMELOT_ROUTER as Address;
const arb_exp = process.env.ARB_EXP;
const eclipPair = (process.env.ECLIP_PAIR || "").split(",") as Address[];
const tiaPair = (process.env.TIA_PAIR || "").split(",") as Address[];

if (!providerUrl || !privateKey || !routerAddress) {
  throw new Error("Please ensure ARB_RPC, YOUR_PRIVATE_KEY, and CAMELOT_ROUTER are set in your .env file");
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

// ABI for the queryNoSplit function
const queryNoSplitAbi: Abi = [
  {
    "inputs": [
      { "internalType": "uint256", "name": "_amountIn", "type": "uint256" },
      { "internalType": "address", "name": "_tokenIn", "type": "address" },
      { "internalType": "address", "name": "_tokenOut", "type": "address" }
    ],
    "name": "queryNoSplit",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "adapter", "type": "address" },
          { "internalType": "address", "name": "recipient", "type": "address" },
          { "internalType": "address", "name": "tokenIn", "type": "address" },
          { "internalType": "address", "name": "tokenOut", "type": "address" },
          { "internalType": "uint256", "name": "amountOut", "type": "uint256" }
        ],
        "internalType": "struct Query",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

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
  amountIn: bigint,
  path: Address[],
  contractAddress: Address,
  adapters: Address[],
  recipients: Address[]
) {
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
    data: swapData
  });

  console.log("Swap transaction successful:", arb_exp+txHash);
}

// Example usage
(async () => {
  const amountIn = parseEther("0.000069420");

  // Specify which path to use, either eclipPair or tiaPair
  const path = tiaPair; // or tiaPair for TIA

  // Example adapters and recipients, should be set accordingly
  const adapters: Address[] = ["0x83Bb6048D55Ea0a84795A939531Fdc1314c0d3e3"];
  const recipients: Address[] = ["0x83Bb6048D55Ea0a84795A939531Fdc1314c0d3e3"];

  // Perform the swap
  await swapNoSplitFromETH(privateKey, amountIn, path, routerAddress, adapters, recipients);
})();
