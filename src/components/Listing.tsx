import { CHAIN_CONFIG, CONTRACT_ABI } from '@/lib/consts'
import useMedusa from '@/hooks/useMedusa'
import { Listing as ListingProps } from '@/stores/globalStore'
import { BigNumber, ethers } from 'ethers'
import { formatEther } from 'ethers/lib/utils'
import { FC, useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  useAccount,
  useContractWrite,
  useNetwork,
  usePrepareContractWrite,
  useWaitForTransaction,
  useProvider,
  useSigner,
} from 'wagmi'
import Signin from '@/components/Signin'
import { useRouter } from 'next/router'
import useCustomTransaction from '@/hooks/useCustomTransaction'

const Listing: FC<ListingProps & { purchased: boolean }> = ({
  cipherId,
  uri,
  name,
  description,
  price,
  purchased,
  seller,
}) => {
  const { isConnected, address } = useAccount()
  const { medusa } = useMedusa()
  const { chain } = useNetwork()
  const provider = useProvider()
  const { data: signer } = useSigner()
  const [hasMedusaKey, setHasMedusaKey] = useState(false)
  const [chainError, setChainError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [txError, setTxError] = useState<string | null>(null)
  const router = useRouter()
  const { sendTransaction, isProcessing: isCustomProcessing, error: customError } = useCustomTransaction()

  // Fetch oracle fees for both methods
  const [oracleFees, setOracleFees] = useState<BigNumber>(BigNumber.from(0));

  // Check if the current user is the owner of the listing
  const isOwner = address?.toLowerCase() === seller?.toLowerCase();

  // Only set chainConfig if chain?.id is defined
  const chainConfig = chain?.id ? CHAIN_CONFIG[chain.id] : undefined

  // Skip contract preparation if medusa keypair is not available or chain is undefined
  const enabled = Boolean(medusa?.keypair) && Boolean(chain) && Boolean(chainConfig)
  
  useEffect(() => {
    setHasMedusaKey(Boolean(medusa?.keypair))
    
    // Check if chain is valid
    if (!chain) {
      setChainError("Please connect to a supported network (Holesky)")
    } else if (!chainConfig) {
      setChainError(`Network ${chain.name} (ID: ${chain.id}) is not supported. Please switch to Holesky.`)
    } else {
      setChainError(null)
    }
  }, [medusa?.keypair, chain, chainConfig])

  useEffect(() => {
    const fetchOracleFees = async () => {
      // Just use a fixed 0.01 ETH fee
      const fixedFee = ethers.utils.parseEther("0.01");
      console.log("Using fixed oracle fee:", ethers.utils.formatEther(fixedFee));
      setOracleFees(fixedFee);
    };
    
    fetchOracleFees();
  }, []);

  const { config, error: prepareError } = usePrepareContractWrite({
    address: chainConfig?.appContractAddress,
    abi: CONTRACT_ABI,
    functionName: 'buyListing',
    args: enabled && medusa?.keypair?.pubkey 
      ? [cipherId, medusa.keypair.pubkey.toEvm()] 
      : undefined,
    enabled: enabled,
    overrides: { 
      value: price.add(oracleFees),
      gasLimit: BigNumber.from(500000), // Set a high gas limit to avoid estimation issues
    },
    chainId: chain?.id,
  })

  const { data, write: buyListing, error: writeError } = useContractWrite({
    ...config,
    onError: (error) => {
      console.error("Contract write error:", error);
      setTxError(error.message);
      toast.dismiss();
      toast.error(`Transaction failed: ${error.message.split('\n')[0]}`);
      setIsProcessing(false);
    }
  })

  useWaitForTransaction({
    hash: data?.hash,
    onSuccess: (txData) => {
      toast.dismiss()
      setIsProcessing(false)
      toast.success(
        <a
          href={`https://holesky.etherscan.io/tx/${txData.transactionHash}`}
          className="inline-flex items-center text-blue-600 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Secret successfully unlocked with Medusa! View on Etherscan
          <svg
            className="ml-2 w-5 h-5"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
          </svg>
        </a>,
      )
    },
    onError: (e) => {
      console.error("Transaction error:", e);
      toast.dismiss()
      setIsProcessing(false)
      toast.error(`Failed to unlock secret: ${e.message.split('\n')[0]}`)
    },
  })

  // Handle transaction success
  useEffect(() => {
    if (data?.hash && !isProcessing) {
      toast.success('Successfully purchased listing!');
      router.push(`/decrypt?ciphertext=${encodeURIComponent(uri)}`);
    }
  }, [data?.hash, isProcessing, router, uri]);

  // Handle transaction errors
  useEffect(() => {
    if (writeError) {
      toast.error(`Error: ${writeError.message || 'Failed to buy listing'}`);
    }
  }, [writeError]);

  // Handle custom transaction errors
  useEffect(() => {
    if (customError) {
      setTxError(customError);
    }
  }, [customError]);

  // Buy the listing with a high gas limit to avoid estimation issues
  const buyListingManually = async () => {
    if (!signer || !chainConfig?.appContractAddress) {
      toast.error('No signer or contract address available');
      return;
    }

    try {
      setIsProcessing(true);
      setTxError(null);

      // Create contract instance
      const contract = new ethers.Contract(
        chainConfig.appContractAddress,
        CONTRACT_ABI,
        signer
      );

      // Check if the listing exists and is still available
      try {
        const listingInfo = await contract.listings(cipherId);
        console.log("Listing info:", listingInfo);
        
        // Check if listing is valid
        if (!listingInfo || !listingInfo.seller || listingInfo.seller === ethers.constants.AddressZero) {
          throw new Error("Listing does not exist or has been removed");
        }
        
        // Check if we're sending the correct price
        if (listingInfo.price && !listingInfo.price.eq(price)) {
          throw new Error(`Price mismatch: expected ${ethers.utils.formatEther(listingInfo.price)} ETH, but got ${ethers.utils.formatEther(price)} ETH`);
        }
      } catch (err: any) {
        console.error("Error checking listing:", err);
        if (err.message.includes("Listing does not exist") || err.message.includes("Price mismatch")) {
          toast.error(err.message);
          setTxError(err.message);
          setIsProcessing(false);
          return;
        }
        // If it's another error, continue with the transaction
      }

      // Just use a fixed 0.01 ETH fee
      const oracleFees = ethers.utils.parseEther("0.01");
      console.log("Using fixed oracle fee:", ethers.utils.formatEther(oracleFees));
      
      // Total value to send is listing price + oracle fees
      const totalValue = price.add(oracleFees);
      
      // Send transaction with high gas limit
      console.log("Sending transaction with args:", {
        cipherId: BigNumber.from(cipherId).toString(),
        pubkey: medusa?.keypair?.pubkey.toEvm(),
        value: ethers.utils.formatEther(totalValue),
        gasLimit: 500000,
        isOwner: address?.toLowerCase() === seller?.toLowerCase()
      });
      
      const tx = await contract.buyListing(
        BigNumber.from(cipherId),
        medusa?.keypair?.pubkey.toEvm(),
        {
          value: totalValue,
          gasLimit: 500000, // High gas limit to avoid estimation issues
        }
      );

      toast.loading('Transaction sent! Waiting for confirmation...');
      console.log('Transaction sent:', tx.hash);

      // Wait for transaction to be mined
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);

      // Check if transaction was successful
      if (receipt.status === 0) {
        throw new Error("Transaction failed on the blockchain");
      }

      toast.dismiss();
      toast.success(address?.toLowerCase() === seller?.toLowerCase() ? 'Successfully initiated decryption!' : 'Successfully purchased listing!');

      // We don't immediately redirect - we need to wait for the ListingDecryption event
      // The EventsFetcher component will catch this event and add it to the store
      // Then the user can view their purchased content in the PurchasedSecrets component
      
      // For now, we'll show a success message and let them know to check their purchased content
      toast.success(
        'Please check your purchased content to view the decrypted file.',
        { duration: 5000 }
      );

    } catch (err: any) {
      console.error('Error in buyListingManually:', err);
      
      // Try to extract a more meaningful error message
      let errorMessage = 'Failed to buy listing';
      
      if (err.message) {
        // Check for common error patterns
        if (err.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds to complete this purchase';
        } else if (err.message.includes('user rejected')) {
          errorMessage = 'Transaction was rejected in your wallet';
        } else if (err.message.includes('CALL_EXCEPTION')) {
          errorMessage = 'Contract call failed. The listing may no longer be available or there might be an issue with the contract.';
        } else if (err.data && err.data.message) {
          // Some providers include the revert reason in err.data.message
          errorMessage = `Contract error: ${err.data.message}`;
        } else {
          // Use the first line of the error message
          errorMessage = err.message.split('\n')[0];
        }
      }
      
      setTxError(errorMessage);
      toast.error(`Transaction failed: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Display any prepare errors
  useEffect(() => {
    if (prepareError) {
      console.error("Prepare error:", prepareError);
      setTxError(prepareError.message);
    }
  }, [prepareError]);

  return (
    <div className="p-6 max-w-sm bg-white rounded-lg border border-gray-200 shadow-md dark:bg-gray-800 dark:border-gray-700">
      <h5 className="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white truncate">
        {name}
      </h5>
      <p className="mb-3 font-normal text-gray-400">{description}</p>
      <p className="mb-3 text-dark-secondary">
        {BigNumber.from(0).eq(price)
          ? 'Free'
          : `${formatEther(price)} ETH`}{' '}
      </p>
      
      {isOwner && (
        <p className="mb-3 text-yellow-500 text-sm">
          You are the owner of this listing
        </p>
      )}
      
      {chainError && (
        <div className="mb-3 text-red-500 text-sm">
          {chainError}
        </div>
      )}
      
      {txError && (
        <div className="mb-3 text-red-500 text-xs overflow-hidden">
          <p>Transaction Error:</p>
          <p className="truncate">{txError.split('\n')[0]}</p>
        </div>
      )}
      
      {hasMedusaKey && !chainError ? (
        <div className="flex flex-col space-y-2">
          <button
            onClick={buyListingManually}
            disabled={isProcessing || !medusa?.keypair}
            className={`w-full py-2 px-4 rounded font-medium ${
              isProcessing || !medusa?.keypair
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isProcessing ? 'Processing...' : isOwner ? 'Decrypt Listing' : 'Buy Listing'}
          </button>
        </div>
      ) : (
        <Signin text={chainError ? "Connect to Holesky" : "Sign to Buy"} />
      )}
    </div>
  )
}

export default Listing
