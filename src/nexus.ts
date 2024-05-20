import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { createWalletClient, prepareEncodeFunctionData, encodeFunctionData, Address, http, fallback,formatUnits } from 'viem';
import { arbitrum } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { bech32ToHex } from './utils';
import { Arbitrum, transferRemoteAbi, quoteGasPayment, getDestinationGasLimit } from './client'; // Updated import
import { DirectSecp256k1Wallet } from '@cosmjs/proto-signing';

// Load environment variables from .env file
config();

const providerUrl = process.env.ARB_RPC as string;
const arb_exp = process.env.ARB_EXP;
const destinationDomain = parseInt(process.env.DESTINATION_DOMAIN || "1853125230", 10);
const neutron_Exp = process.env.NEUTRON_EXP || "https://www.mintscan.io/neutron/address/" as string;
const tiaArbAddress = process.env.TIA_ARB as Address;
const eclipArbAddress = process.env.ECLIP_ARB as Address;

if (!providerUrl || !destinationDomain) {
  throw new Error("Please ensure ARB_RPC and DESTINATION_DOMAIN are set in your .env file");
}

// Utility function to get the bech32 address from a private key
export async function getBech32Address(privateKeyHex: string, prefix: string): Promise<string> {
  const privateKey = Uint8Array.from(Buffer.from(privateKeyHex.slice(2), 'hex'));
  const wallet = await DirectSecp256k1Wallet.fromKey(privateKey, prefix);
  const [firstAccount] = await wallet.getAccounts();
  return firstAccount.address;
}

// Prepare encoding for the transfer function once
const transferRemoteEncode = prepareEncodeFunctionData({
  abi: transferRemoteAbi,
  functionName: 'transferRemote',
});

// Create a function to perform the transfer
export async function transferRemote(
  privateKey: `0x${string}`,
  contractAddress: Address,
  destinationChainId: number,
  recipientBech32: string,
  amount: bigint,
  nonce: number
) {
  // Convert recipient address from bech32 to hex and pad to 32 bytes
  let recipientHex = bech32ToHex(recipientBech32).slice(2); // Remove '0x' prefix
  while (recipientHex.length < 64) {
    recipientHex = '0' + recipientHex;
  }
  recipientHex = '0x' + recipientHex;

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

  // Calculate gas fees dynamically
 // Calculate gas fees dynamically
 const localGasFee = await quoteGasPayment(Arbitrum, contractAddress, destinationChainId);
 //const interchainGasFee = await getDestinationGasLimit(Arbitrum, contractAddress, destinationChainId); // Adjust gas limit as needed
  // Encode function data using prepared transferRemoteEncode
  const transferData = encodeFunctionData({
    abi: transferRemoteAbi,
    functionName: transferRemoteEncode.functionName,
    args: [
      destinationChainId,
      recipientHex,
      amount
    ]
  });

  // Calculate the total value to be sent with the transaction
  const value = localGasFee;

  // Perform the transfer transaction
  try {
    const txHash = await walletClient.sendTransaction({
      account,
      to: contractAddress,
      data: transferData,
      nonce,  // Provide the nonce here
      value   // Add value for gas fee
    });

    console.log(`✅ Successfully transferred ${formatUnits(amount, 6)} tokens for ${recipientBech32} on Neutron-chain for account ${account.address}`);
    console.log(arb_exp + txHash);
    console.log(`💰 Awaiting ${formatUnits(amount, 6)} tokens on Neutron-chain for account: ${neutron_Exp}${recipientBech32}`);
  } catch (error) {
    console.error("Transfer failed:", error);
    throw error;
  }
}

// Create a function to execute transfers based on coins.json and private_keys.txt
export async function executeTransfers(privateKeys: `0x${string}`[], balances: any[]) {
  const coinsFilePath = path.resolve('./data/coins.json');

  for (let i = 0; i < privateKeys.length; i++) {
    const privateKey = privateKeys[i] as `0x${string}`;
    const account = privateKeyToAccount(privateKey);

    // Get the current nonce for the account
    let nonce = await Arbitrum.getTransactionCount({ address: account.address });

    // Get the bech32 address for the account
    const bech32Address = await getBech32Address(privateKey, 'neutron');

    // Find the corresponding balances in coins.json
    const accountData = balances.find((item: any) => item.address === account.address);

    if (accountData) {
      const tiaAmount = BigInt(accountData.TIA_ARB);
      const eclipAmount = BigInt(accountData.ECLIP_ARB);

      try {
        // Transfer TIA_ARB tokens
        console.log(`🔄 Transferring ${formatUnits(tiaAmount, 6)} TIA.n to ${bech32Address} for Account ${i + 1}: ${account.address}`);
        await transferRemote(privateKey, tiaArbAddress, destinationDomain, bech32Address, tiaAmount, nonce);
        nonce++;

        // Transfer ECLIP_ARB tokens
        console.log(`🔄 Transferring ${formatUnits(eclipAmount, 6)} Eclipse to ${bech32Address} for Account ${i + 1}: ${account.address}`);
        await transferRemote(privateKey, eclipArbAddress, destinationDomain, bech32Address, eclipAmount, nonce);
        nonce++;
      } catch (error) {
        const errorMessage = (error as Error).message;
        if (errorMessage.includes("insufficient funds") || errorMessage.includes("ERC20: burn amount exceeds balance")) {
          console.error(`Skipping account ${account.address} due to error: ${errorMessage}`);
          continue;
        } else {
          throw error; // Rethrow the error if it's not a specific error we want to skip
        }
      }

      // Remove the processed account from the balances array
      balances = balances.filter((item: any) => item.address !== account.address);

      // Update the coins.json file
      fs.writeFileSync(coinsFilePath, JSON.stringify(balances, null, 2));
    }
  }

  // Delete the coins.json file if it's empty
  if (balances.length === 0) {
    fs.unlinkSync(coinsFilePath);
    console.log("All accounts processed. coins.json file has been deleted.");
  }
}
