import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

// Declare the window.ethereum type
declare global {
  interface Window {
    ethereum: any;
  }
}

// Get all available RPC URLs from environment variables
const getRpcUrls = (): string[] => {
  const urls = [
    process.env.NEXT_PUBLIC_HOLESKY_RPC_URL,
    process.env.NEXT_PUBLIC_HOLESKY_RPC_URL_BACKUP1,
    process.env.NEXT_PUBLIC_HOLESKY_RPC_URL_BACKUP2,
    process.env.NEXT_PUBLIC_HOLESKY_RPC_URL_BACKUP3,
    process.env.NEXT_PUBLIC_HOLESKY_RPC_URL_BACKUP4,
  ].filter(Boolean) as string[];
  
  // If no URLs are found, use default fallbacks
  if (urls.length === 0) {
    return [
      'https://ethereum-holesky.publicnode.com',
      'https://holesky.rpc.thirdweb.com',
      'https://holesky.blockpi.network/v1/rpc/public',
    ];
  }
  
  return urls;
};

interface UseCustomTransactionReturn {
  sendTransaction: (
    contractAddress: string,
    abi: any[],
    method: string,
    args: any[],
    options?: { value?: ethers.BigNumber; gasLimit?: number }
  ) => Promise<ethers.providers.TransactionReceipt | null>;
  isProcessing: boolean;
  error: string | null;
}

/**
 * Custom hook to handle transactions with fallback RPC URLs
 */
export default function useCustomTransaction(): UseCustomTransactionReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendTransaction = useCallback(
    async (
      contractAddress: string,
      abi: any[],
      method: string,
      args: any[],
      options: { value?: ethers.BigNumber; gasLimit?: number } = {}
    ): Promise<ethers.providers.TransactionReceipt | null> => {
      setIsProcessing(true);
      setError(null);
      
      // Get all available RPC URLs
      const rpcUrls = getRpcUrls();
      console.log("Available RPC URLs for transaction:", rpcUrls);
      
      // Try each RPC URL until one works
      for (let i = 0; i < rpcUrls.length; i++) {
        const rpcUrl = rpcUrls[i];
        console.log(`Trying RPC URL ${i + 1}/${rpcUrls.length}: ${rpcUrl}`);
        
        try {
          // Create a provider with the current RPC URL
          const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
          
          // Request accounts from the browser
          if (!window.ethereum) {
            throw new Error("No Ethereum provider found. Please install a wallet like MetaMask.");
          }
          
          // Create a web3 provider using the browser's provider
          const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
          const signer = web3Provider.getSigner();
          const signerAddress = await signer.getAddress();
          
          // Create a contract instance
          const contract = new ethers.Contract(contractAddress, abi, signer);
          
          // Prepare transaction options
          const txOptions: { value?: ethers.BigNumber; gasLimit?: number } = {};
          if (options.value) {
            txOptions.value = options.value;
          }
          if (options.gasLimit) {
            txOptions.gasLimit = options.gasLimit;
          } else {
            // Set a default high gas limit to avoid estimation issues
            txOptions.gasLimit = 500000;
          }
          
          console.log(`Sending transaction to ${method} with args:`, args, "and options:", txOptions);
          
          // Send the transaction
          const tx = await contract[method](...args, txOptions);
          console.log("Transaction sent:", tx.hash);
          
          // Show a loading toast
          toast.loading(`Transaction sent! Waiting for confirmation...`);
          
          // Wait for the transaction to be mined
          const receipt = await tx.wait();
          console.log("Transaction confirmed:", receipt);
          
          // Clear the loading toast and show a success toast
          toast.dismiss();
          
          // Create a clickable link in the toast message
          const txUrl = `https://holesky.etherscan.io/tx/${receipt.transactionHash}`;
          toast.success(`Transaction successful! View on Etherscan: ${txUrl}`, {
            duration: 5000
          });
          
          // Open the transaction URL in a new tab
          window.open(txUrl, '_blank');
          
          setIsProcessing(false);
          return receipt;
        } catch (error: any) {
          console.error(`Error with RPC URL ${rpcUrl}:`, error);
          
          // If this is the last RPC URL, set the error and return null
          if (i === rpcUrls.length - 1) {
            const errorMessage = error?.message || "Unknown error occurred";
            setError(errorMessage);
            toast.dismiss();
            toast.error(`Transaction failed: ${errorMessage.split('\n')[0]}`);
            setIsProcessing(false);
            return null;
          }
          
          // Otherwise, try the next RPC URL
          console.log(`Trying next RPC URL...`);
        }
      }
      
      // This should never be reached, but just in case
      setIsProcessing(false);
      return null;
    },
    []
  );

  return { sendTransaction, isProcessing, error };
} 