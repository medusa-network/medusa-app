import { FC, useEffect, useState } from 'react'
import {
  useAccount,
  useContract,
  useContractEvent,
  useNetwork,
  useProvider,
} from 'wagmi'

import { CHAIN_CONFIG, CONTRACT_ABI } from '@/lib/consts'
import {
  Listing,
  Sale,
  Decryption,
  default as useGlobalStore,
} from '@/stores/globalStore'
import { BigNumber, ethers } from 'ethers'
import { HGamalEVMCipher as Ciphertext } from '@medusa-network/medusa-sdk'

// Type definition for the reencrypted cipher from the contract
type G1Point = {
  x: BigNumber;
  y: BigNumber;
};

type ReencryptedCipher = {
  random: G1Point;
};

const EventsFetcher: FC = () => {
  const provider = useProvider()
  const { address } = useAccount()
  const { chain } = useNetwork()
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false)

  const updateListings = useGlobalStore((state) => state.updateListings)
  const updateSales = useGlobalStore((state) => state.updateSales)
  const updateDecryptions = useGlobalStore((state) => state.updateDecryptions)

  const addListing = useGlobalStore((state) => state.addListing)
  const addSale = useGlobalStore((state) => state.addSale)
  const addDecryption = useGlobalStore((state) => state.addDecryption)

  const listings = useGlobalStore((state) => state.listings)
  const sales = useGlobalStore((state) => state.sales)
  const decryptions = useGlobalStore((state) => state.decryptions)

  const chainConfig = chain?.id ? CHAIN_CONFIG[chain.id] : undefined

  // We're not using useContractEvent for NewListing because there's a mismatch between
  // the contract's event definition and the ABI in the frontend
  // Instead, we'll fetch past events manually

  useContractEvent({
    address: chainConfig?.appContractAddress,
    abi: CONTRACT_ABI,
    eventName: 'NewSale',
    listener(
      buyer: string,
      seller: string,
      requestId: BigNumber,
      cipherId: BigNumber,
    ) {
      console.log("New sale event detected:", { buyer, seller, requestId, cipherId });
      if (buyer === address) {
        addSale({ buyer, seller, requestId, cipherId })
      }
    },
  })

  useContractEvent({
    address: chainConfig?.appContractAddress,
    abi: CONTRACT_ABI,
    eventName: 'ListingDecryption',
    listener(requestId: BigNumber, reencryptedCipher: ReencryptedCipher) {
      console.log("Listing decryption event detected on OnlyFiles contract:", { requestId, reencryptedCipher });
      // Convert ReencryptedCipher to Ciphertext format
      const ciphertext: Ciphertext = {
        random: reencryptedCipher.random,
        cipher: BigNumber.from(0), // Not used for decryption
        random2: { x: BigNumber.from(0), y: BigNumber.from(0) }, // Not used for decryption
        dleq: { f: BigNumber.from(0), e: BigNumber.from(0) }, // Not used for decryption
      };
      addDecryption({ requestId, ciphertext })
    },
  })

  const onlyFiles = useContract({
    address: chainConfig?.appContractAddress,
    abi: CONTRACT_ABI,
    signerOrProvider: provider,
  })

  // Function to fetch logs in chunks to avoid exceeding the block range limit
  const fetchLogsInChunks = async (
    contract: ethers.Contract,
    fromBlock: number,
    toBlock: number,
    topics: (string | string[] | null)[] | undefined,
    chunkSize: number = 40000 // Use a slightly smaller chunk size than the limit (50,000) to be safe
  ) => {
    console.log(`Fetching logs from block ${fromBlock} to ${toBlock} in chunks of ${chunkSize}`);
    
    const allLogs: ethers.providers.Log[] = [];
    
    // Process in chunks
    for (let currentBlock = fromBlock; currentBlock <= toBlock; currentBlock += chunkSize) {
      const endBlock = Math.min(currentBlock + chunkSize - 1, toBlock);
      
      console.log(`Fetching chunk from block ${currentBlock} to ${endBlock}`);
      
      try {
        const logs = await provider.getLogs({
          address: contract.address,
          topics: topics,
          fromBlock: currentBlock,
          toBlock: endBlock
        });
        
        console.log(`Found ${logs.length} logs in chunk from block ${currentBlock} to ${endBlock}`);
        allLogs.push(...logs);
      } catch (error) {
        console.error(`Error fetching logs for chunk ${currentBlock} to ${endBlock}:`, error);
        
        // If the chunk is still too large, try with a smaller chunk size
        if (endBlock - currentBlock > 10000) {
          console.log("Chunk too large, trying with smaller chunks");
          const smallerChunkLogs = await fetchLogsInChunks(
            contract,
            currentBlock,
            endBlock,
            topics,
            Math.floor(chunkSize / 2)
          );
          allLogs.push(...smallerChunkLogs);
        } else {
          // If the chunk is already small and still failing, log the error but continue
          console.error("Failed to fetch logs even with small chunk size, continuing with next chunk");
        }
      }
    }
    
    return allLogs;
  };

  // Function to fetch past events
  const fetchPastEvents = async () => {
    if (!onlyFiles || !provider || !chainConfig) return;
    
    setIsLoading(true);
    console.log("Starting to fetch past events...");
    
    try {
      console.log("Fetching past events...");
      
      // Create a contract instance with ethers
      const contract = new ethers.Contract(
        chainConfig.appContractAddress,
        CONTRACT_ABI,
        provider
      );
      
      // Get current block number
      const currentBlock = await provider.getBlockNumber();
      console.log("Current block:", currentBlock);
      
      // Calculate blocks for approximately 2 days (assuming ~12 sec block time on Holesky)
      // 2 days = 48 hours = 2880 minutes = 172800 seconds
      // 172800 seconds / 12 seconds per block ≈ 14400 blocks
      const blocksFor2Days = 14400;
      
      // Fetch past NewListing events (last 2 days of blocks)
      const fromBlock = Math.max(0, currentBlock - blocksFor2Days);
      console.log(`Fetching events from block ${fromBlock} to ${currentBlock} (approximately 2 days)`);
      
      // Use the correct event signature for NewListing
      const newListingTopic = ethers.utils.id("NewListing(address,uint256,tuple,string,string,uint256,string)");
      console.log("NewListing topic:", newListingTopic);
      
      // Get logs in chunks to avoid exceeding the block range limit
      const logs = await fetchLogsInChunks(
        contract,
        fromBlock,
        currentBlock,
        [newListingTopic]
      );
      
      console.log("Found", logs.length, "listing logs in total");
      
      let foundListings = false;
      
      // If no logs found, try a more direct approach
      if (logs.length === 0) {
        console.log("No logs found with topic. Trying a more direct approach...");
        
        // Try to get all logs for the contract in chunks
        const allLogs = await fetchLogsInChunks(
          contract,
          fromBlock,
          currentBlock,
          undefined
        );
        
        console.log("Found", allLogs.length, "total logs for the contract");
        
        // Try to parse each log
        for (const log of allLogs) {
          try {
            const parsedLog = contract.interface.parseLog(log);
            console.log("Parsed log:", parsedLog.name, parsedLog.args);
            
            // If this is a NewListing event, process it
            if (parsedLog.name === "NewListing") {
              // Only process listings with valid URIs for our storage system
              // Skip if URI is not a valid storage URI
              if (!parsedLog.args.uri || !isValidStorageUri(parsedLog.args.uri)) {
                console.log("Skipping listing with invalid URI:", parsedLog.args.uri);
                continue;
              }
              
              const listing: Listing = {
                seller: parsedLog.args.seller,
                cipherId: parsedLog.args.cipherId,
                name: parsedLog.args.name,
                description: parsedLog.args.description,
                price: parsedLog.args.price,
                uri: parsedLog.args.uri
              };
              
              console.log("Adding listing from parsed log:", listing);
              addListing(listing);
              foundListings = true;
            }
          } catch (err) {
            console.error("Error parsing log:", err);
          }
        }
      } else {
        // Process the logs we found
        for (const log of logs) {
          try {
            const parsedLog = contract.interface.parseLog(log);
            console.log("Parsed log:", parsedLog);
            
            if (parsedLog && parsedLog.args) {
              // Only process listings with valid URIs for our storage system
              if (!parsedLog.args.uri || !isValidStorageUri(parsedLog.args.uri)) {
                console.log("Skipping listing with invalid URI:", parsedLog.args.uri);
                continue;
              }
              
              const listing: Listing = {
                seller: parsedLog.args.seller,
                cipherId: parsedLog.args.cipherId,
                name: parsedLog.args.name,
                description: parsedLog.args.description,
                price: parsedLog.args.price,
                uri: parsedLog.args.uri
              };
              
              console.log("Adding listing:", listing);
              addListing(listing);
              foundListings = true;
            }
          } catch (err) {
            console.error("Error parsing log:", err);
          }
        }
      }
      
      // As a fallback, let's try to directly query the contract for listings
      if (!foundListings) {
        console.log("No listings found from logs, trying direct contract queries...");
        
        try {
          // Try to get multiple listings by ID
          for (let i = 1; i <= 10; i++) {
            try {
              const listing = await contract.listings(i).catch(() => null);
              if (listing && listing.seller && !listing.seller.startsWith('0x0000000')) {
                console.log(`Found listing with ID ${i}:`, listing);
                
                // Only add if it has a valid storage URI
                if (isValidStorageUri(listing.uri)) {
                  // Add this listing to the store with placeholder values for name and description
                  const listingObj: Listing = {
                    seller: listing.seller,
                    cipherId: BigNumber.from(i),
                    name: `Listing #${i}`,
                    description: "This listing was found directly in the contract",
                    price: listing.price,
                    uri: listing.uri
                  };
                  
                  console.log("Adding listing from contract:", listingObj);
                  addListing(listingObj);
                  foundListings = true;
                } else {
                  console.log(`Skipping listing ${i} with invalid URI:`, listing.uri);
                }
              }
            } catch (err) {
              console.log(`No listing found with ID ${i}`);
            }
          }
        } catch (err) {
          console.error("Error querying contract directly:", err);
        }
      }
      
      if (!foundListings) {
        console.log("WARNING: No listings found through any method!");
      }
      
      setHasAttemptedFetch(true);
    } catch (error: any) {
      console.error("Error fetching past events:", error);
      setError(`Error fetching past events: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to check if a URI is valid for our storage system
  const isValidStorageUri = (uri: string): boolean => {
    if (!uri || typeof uri !== 'string') return false;
    
    // Check if it's a valid S3 key format (not starting with ipfs://)
    return !uri.startsWith('ipfs://');
  };

  useEffect(() => {
    // Reset error state
    setError(null);
    
    // Collect debug information
    const debug = {
      chainId: chain?.id,
      chainName: chain?.name,
      contractAddress: chainConfig?.appContractAddress,
      envContractAddress: process.env.NEXT_PUBLIC_ONLYFILES_ADDRESS,
      isConnected: !!provider,
      hasChainConfig: !!chainConfig,
      supportedChainIds: Object.keys(CHAIN_CONFIG).map(id => parseInt(id)),
      expectedChainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "17000"),
      needsNetworkSwitch: chain?.id !== parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "17000"),
      currentListings: listings.length,
      hasAttemptedFetch: hasAttemptedFetch,
      isLoading: isLoading
    };
    
    setDebugInfo(JSON.stringify(debug, null, 2));
    
    console.log("Debug info:", debug);

    // Validate onlyFiles contract
    if (!chain) {
      const errorMsg = "CRITICAL ERROR: No network connected! Please connect to the Holesky network (Chain ID: 17000)."
      console.error(errorMsg)
      setError(errorMsg)
      return
    }
    
    if (!chainConfig) {
      const errorMsg = `CRITICAL ERROR: Chain ${chain.name} (ID: ${chain.id}) is not supported. Please switch to Holesky.`
      console.error(errorMsg)
      setError(errorMsg)
      return
    }
    
    if (!provider) {
      const errorMsg = "CRITICAL ERROR: No provider available. Please refresh the page and try again."
      console.error(errorMsg)
      setError(errorMsg)
      return
    }
    
    // Fetch past events when the component mounts and when the chain or provider changes
    fetchPastEvents().catch(error => {
      console.error("Error in fetchPastEvents:", error);
      setError(`Failed to fetch past events: ${error.message}`);
      setIsLoading(false);
    });
    
  }, [chain, provider, chainConfig]);

  // Force a re-fetch if listings are empty after initial load
  useEffect(() => {
    if (!isLoading && hasAttemptedFetch && listings.length === 0 && chainConfig && provider) {
      console.log("No listings found after initial load, trying again...");
      fetchPastEvents().catch(error => {
        console.error("Error in retry fetchPastEvents:", error);
      });
    }
  }, [isLoading, hasAttemptedFetch, listings.length, chainConfig, provider]);

  // Display error if present
  if (error) {
    return (
      <div className="bg-red-600 text-white p-4 rounded-md shadow-lg m-4">
        <h2 className="text-xl font-bold mb-2">Contract Error</h2>
        <p>{error}</p>
        {debugInfo && (
          <div className="mt-4">
            <h3 className="text-lg font-bold">Debug Information:</h3>
            <pre className="bg-gray-800 p-2 rounded mt-2 overflow-auto text-xs">
              {debugInfo}
            </pre>
          </div>
        )}
        {chain?.id !== parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "17000") && (
          <div className="mt-4">
            <p className="font-bold">Please switch to the Holesky network in your wallet to use this app.</p>
          </div>
        )}
      </div>
    )
  }

  // Display loading state
  if (isLoading) {
    return (
      <div className="bg-blue-600 text-white p-4 rounded-md shadow-lg m-4">
        <h2 className="text-xl font-bold mb-2">Loading Listings...</h2>
        <p>Please wait while we fetch listings from the blockchain.</p>
      </div>
    )
  }

  return <> </>
}

export default EventsFetcher
