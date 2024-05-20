import { createPublicClient, http, Abi, Address, erc20Abi, Chain } from 'viem';
import { arbitrum, bsc } from 'viem/chains';

export const Arbitrum = createPublicClient({
  chain: arbitrum,
  transport: http()
});

export const BSC = createPublicClient({
  chain: bsc,
  transport: http()
});

// Define the ABI for the transferRemote function
export const transferRemoteAbi: Abi = [
  {
    "inputs": [
      { "internalType": "uint32", "name": "_destination", "type": "uint32" },
      { "internalType": "bytes32", "name": "_recipient", "type": "bytes32" },
      { "internalType": "uint256", "name": "_amountOrId", "type": "uint256" }
    ],
    "name": "transferRemote",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Define the ABI for gas calculation functions
const gasCalculationAbi: Abi = [
  {
    "inputs": [{ "internalType": "uint32", "name": "_destinationDomain", "type": "uint32" }],
    "name": "quoteGasPayment",
    "outputs": [{ "internalType": "uint256", "name": "_gasPayment", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint32", "name": "_destinationDomain", "type": "uint32" },
      { "internalType": "uint256", "name": "_gasLimit", "type": "uint256" }
    ],
    "name": "destinationGas",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

export const nautilusChain: Chain = {
  id: 22222,
  name: 'Nautilus',
  nativeCurrency: {
    name: 'Nautilus Coin',
    symbol: 'ZBC',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://api.nautilus.nautchain.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Nautscan', url: 'https://nautscan.com/mainnet/search/' },
  },
};

export const Nautilus = createPublicClient({
  chain: nautilusChain,
  transport: http()
});

// ABI for the queryNoSplit function
export const queryNoSplitAbi: Abi = [
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

// Utility function to get token balance
export async function getTokenBalance(client: any, tokenAddress: Address, userAddress: Address): Promise<bigint> {
  const result = await client.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [userAddress]
  });
  return BigInt(result);
}

// Utility function to get token decimals
export async function getTokenDecimals(client: any, tokenAddress: Address): Promise<number> {
  const result = await client.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'decimals',
  });
  return Number(result);
}

// Utility function to quote gas payment
export async function quoteGasPayment(client: any, contractAddress: Address, destinationDomain: number): Promise<bigint> {
  const result = await client.readContract({
    address: contractAddress,
    abi: gasCalculationAbi,
    functionName: 'quoteGasPayment',
    args: [destinationDomain]
  });
  return BigInt(result);
}

// Utility function to get destination gas limit
export async function getDestinationGasLimit(client: any, contractAddress: Address, destinationDomain: number): Promise<bigint> {
  const result = await client.readContract({
    address: contractAddress,
    abi: gasCalculationAbi,
    functionName: 'destinationGas',
    args: [destinationDomain]
  });
  return BigInt(result);
}
