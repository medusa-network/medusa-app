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
  // TODO: Resolve ABI mismatch and use useContractEvent for real-time updates

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
    chunkSize: number = 10000 // Use a slightly smaller chunk size than the limit (50,000) to be safe
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
  const fetchPastEvents = async (
      currentChainId: number, 
      currentContractAddress: string
    ) => {
    // Add check for address as well, no need to fetch if wallet not connected
    // Also check the passed-in values
    if (!onlyFiles || !provider || !address || !currentChainId || !currentContractAddress) {
      console.log("Skipping fetchPastEvents: missing provider, address, chainId or contractAddress");
      setIsLoading(false); // Ensure loading state is turned off
      return; 
    }
    
    setIsLoading(true);
    console.log("Starting to fetch past events...");
    
    try {
      // Create a contract instance with ethers
      const contract = new ethers.Contract(
        currentContractAddress, // Use passed-in address
        CONTRACT_ABI,
        provider
      );
      
      // Get current block number
      const currentBlock = await provider.getBlockNumber();
      console.log("Current block:", currentBlock);

      // --- Caching Logic --- 
      // Derive storage key *inside* the function using current values
      const lastBlockStorageKey = `lastFetchedBlock_${currentChainId}_${currentContractAddress}`;
      console.log("Using storage key inside fetchPastEvents:", lastBlockStorageKey);
      
      // Calculate blocks for approximately 2 days (assuming ~12 sec block time on Holesky)
      // 2 days = 48 hours = 2880 minutes = 172800 seconds
      // 172800 seconds / 12 seconds per block ≈ 14400 blocks
      const blocksFor60Days = 14400*30;

      // Get the last fetched block from local storage, default to 30 days ago if not found or invalid
      let lastFetchedBlock = Math.max(0, currentBlock - blocksFor60Days);

      try {
        const storedBlock = localStorage.getItem(lastBlockStorageKey);
        console.log(`Value read from localStorage for key '${lastBlockStorageKey}':`, storedBlock); // Log the raw value read
        if (storedBlock) {
          const parsedBlock = parseInt(storedBlock, 10);
          if (!isNaN(parsedBlock) && parsedBlock >= 0) {
            lastFetchedBlock = parsedBlock;
          } else {
            console.warn("Invalid block number found in cache, defaulting to 0.", { storedBlock });
          }
        }
      } catch (e) {
        console.error("Error reading last fetched block from local storage:", e);
        // Proceed with default lastFetchedBlock = 0
      }
      console.log("Last fetched block from cache:", lastFetchedBlock);

      // Determine the starting block for the new fetch
      // Start from the block *after* the last fetched one
      const fromBlock = lastFetchedBlock + 1; 

      // If fromBlock is already >= currentBlock, no new blocks to fetch
      if (fromBlock >= currentBlock) {
        console.log(`No new blocks to fetch. Current: ${currentBlock}, Last Fetched: ${lastFetchedBlock}`);
        setIsLoading(false);
        setHasAttemptedFetch(true); // Mark fetch as attempted
        return;
      }
      // --- End Caching Logic ---

      console.log(`Fetching events from block ${fromBlock} to ${currentBlock}`);
      
      // Use the correct event signature for NewListing
      const newListingTopic = ethers.utils.id("NewListing(address,uint256,tuple,string,string,uint256,string)");
      console.log("NewListing topic:", newListingTopic);
      
      // Get logs in chunks to avoid exceeding the block range limit
      const logs = await fetchLogsInChunks(
        contract,
        fromBlock, // Start from the block after the last fetch
        currentBlock,
        [newListingTopic]
      );
      
      console.log("Found", logs.length, "new listing logs since block", fromBlock);
      
      // Collect NEW listings found in this range
      const newListingsFromFetch: Listing[] = []; 
      
      // If no logs found with topic, try direct approach for the *new* block range
      if (logs.length === 0) {
        console.log("No logs found with topic. Trying a more direct approach...");
        
        const allLogs = await fetchLogsInChunks(
          contract,
          fromBlock, // Search only new block range
          currentBlock,
          undefined
        );
        
        console.log("Found", allLogs.length, "total new logs for the contract since block", fromBlock);
        
        for (const log of allLogs) {
          try {
            const parsedLog = contract.interface.parseLog(log);
            console.log("Parsed log:", parsedLog.name, parsedLog.args);
            
            // If this is a NewListing event, process it
            if (parsedLog.name === "NewListing") {
              // Log the raw args for debugging
              console.log("Raw args from parsed log (direct approach):", parsedLog.args);

              // Check URI validity
              const uri = parsedLog.args.uri;
              const isValidUri = isValidStorageUri(uri);
              console.log(`Listing from log (direct): URI='${uri}', isValid=${isValidUri}`);

              // Only process listings with valid URIs for our storage system
              if (isValidUri) {
                const listing: Listing = {
                  seller: parsedLog.args.seller,
                  cipherId: parsedLog.args.cipherId,
                  name: parsedLog.args.name,
                  description: parsedLog.args.description,
                  price: parsedLog.args.price,
                  uri: uri
                };
                
                // Note: We only add listings found in the *new* block range
                console.log("Collecting NEW listing from parsed log (direct):", listing);
                newListingsFromFetch.push(listing); 
              } else {
                console.log("Skipping listing from log (direct) due to invalid URI:", uri);
              }
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
              // Log the raw args for debugging
              console.log("Raw args from parsed log (topic approach):", parsedLog.args);

              // Check URI validity
              const uri = parsedLog.args.uri;
              const isValidUri = isValidStorageUri(uri);
              console.log(`Listing from log (topic): URI='${uri}', isValid=${isValidUri}`);

              // Only process listings with valid URIs for our storage system
              if (isValidUri) {
                const listing: Listing = {
                  seller: parsedLog.args.seller,
                  cipherId: parsedLog.args.cipherId,
                  name: parsedLog.args.name,
                  description: parsedLog.args.description,
                  price: parsedLog.args.price,
                  uri: uri
                };
                
                // Note: We only add listings found in the *new* block range
                console.log("Collecting NEW listing:", listing);
                newListingsFromFetch.push(listing); 
              } else {
                console.log("Skipping listing from log (topic) due to invalid URI:", uri);
              }
            }
          } catch (err) {
            console.error("Error parsing log:", err);
          }
        }
      }
      
      // Add newly found listings to the store (addListing handles deduplication)
      if (newListingsFromFetch.length > 0) {
        console.log(`Adding ${newListingsFromFetch.length} newly found listings to the store.`);
        newListingsFromFetch.forEach(addListing); // Add each new listing
      }
      
      // --- Caching Logic --- 
      // Update the last fetched block in local storage *after* successful processing
      try {
        console.log(`Attempting to write last fetched block to local storage. Key: '${lastBlockStorageKey}', Value: ${currentBlock}`);
        localStorage.setItem(lastBlockStorageKey, currentBlock.toString());
        console.log("Successfully updated last fetched block in cache to:", currentBlock);
      } catch (e) {
        console.error("Error writing last fetched block to local storage:", { key: lastBlockStorageKey, value: currentBlock, error: e });
      }
      // --- End Caching Logic ---

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

    // Log the raw chain object from wagmi
    console.log("Wagmi detected chain:", chain);
    
    // Construct the expected storage key based on current chain/config
    // This key is only used for DEBUG logging now
    const currentStorageKeyForDebug = `lastFetchedBlock_${chain?.id || 'unknown'}_${chainConfig?.appContractAddress || 'unknown'}`;

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
      // listings.length might reflect cached value initially
      currentListingsInStore: listings.length, 
      hasAttemptedFetch: hasAttemptedFetch,
      isLoading: isLoading,
      lastBlockStorageKey: currentStorageKeyForDebug, // Log the key derived here
      lastBlockValue: localStorage.getItem(currentStorageKeyForDebug) // Read using the key derived here
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
    
    // Ensure we pass the validated chainId and contractAddress
    const validatedChainId = chain.id;
    const validatedContractAddress = chainConfig.appContractAddress;
    
    // Log the values being passed to fetchPastEvents
    console.log(`Calling fetchPastEvents with chainId: ${validatedChainId}, contractAddress: ${validatedContractAddress}`);
    
    fetchPastEvents(validatedChainId, validatedContractAddress).catch(error => {
      console.error("Error in fetchPastEvents:", error);
      setError(`Failed to fetch past events: ${error.message}`);
      setIsLoading(false);
    });
    
  }, [chain, provider, chainConfig, address]); // Add address dependency

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
