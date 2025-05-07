import { FC, useEffect, useState } from 'react'
import Image from 'next/image'
import useGlobalStore, { Sale } from '@/stores/globalStore'
import { BigNumber, ethers } from 'ethers'
import { formatEther } from 'ethers/lib/utils'
import { Base64 } from 'js-base64'
import { getStorageLink } from '@/lib/utils'
import { useNetwork, useProvider } from 'wagmi'
import Signin from '@/components/Signin'
import { CHAIN_CONFIG, CONTRACT_ABI } from '@/lib/consts'

const Unlocked: FC<Sale> = ({ buyer, seller, requestId, cipherId }) => {
  const medusa = useGlobalStore((state) => state.medusa)
  const provider = useProvider()
  const { chain } = useNetwork()
  const chainConfig = chain?.id ? CHAIN_CONFIG[chain.id] : undefined

  const listings = useGlobalStore((state) => state.listings)
  const decryptions = useGlobalStore((state) => state.decryptions)
  const updateDecryptions = useGlobalStore((state) => state.updateDecryptions)

  const listing = listings.find((listing) => listing.cipherId.eq(cipherId))
  const decryption = decryptions.find((d) => d.requestId.eq(requestId))

  const [plaintext, setPlaintext] = useState<string | null>()
  const [downloadLink, setDownloadLink] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [attemptCount, setAttemptCount] = useState(0)

  const checkPastEvents = async () => {
    if (!listing || !provider || !chainConfig) return;

    try {
      // Create a contract instance
      const contract = new ethers.Contract(
        chainConfig.appContractAddress,
        CONTRACT_ABI,
        provider
      );

      // Get current block number
      const currentBlock = await provider.getBlockNumber();
      
      // Calculate blocks for approximately 1 hour (assuming ~12 sec block time)
      // 1 hour = 3600 seconds / 12 seconds per block ≈ 300 blocks
      const blocksForOneHour = 300;
      const fromBlock = Math.max(0, currentBlock - blocksForOneHour);

      // Get past ListingDecryption events
      const filter = contract.filters.ListingDecryption();
      const events = await contract.queryFilter(filter, fromBlock, currentBlock);

      // Check if any of the events match our requestId
      for (const event of events) {
        if (!event.args) continue;
        const [eventRequestId, reencryptedCipher] = event.args;
        if (eventRequestId?.eq(requestId)) {
          console.log("Found past decryption event:", { requestId: eventRequestId });
          updateDecryptions([...decryptions, { requestId: eventRequestId, ciphertext: reencryptedCipher }]);
          return true;
        }
      }

      return false;
    } catch (err) {
      console.error("Error checking past events:", err);
      return false;
    }
  };

  const handleRetry = async () => {
    setError(null);
    setAttemptCount(0);
    setIsDecrypting(true);

    // First check for past events
    const foundPastEvent = await checkPastEvents();
    if (!foundPastEvent) {
      // If no past event found, start the normal polling process
      setIsDecrypting(true);
    }
  };

  // Effect to handle when decryption data isn't available yet
  useEffect(() => {
    // If we have a listing but no decryption data yet, start checking for it
    if (listing && !decryption) {
      setIsDecrypting(true);
      setError(null);

      // Check every 6 seconds, for up to 10 minutes (100 attempts)
      const interval = setInterval(() => {
        setAttemptCount((prev) => {
          const newCount = prev + 1;
          if (newCount > 100) {
            setError("Timeout waiting for decryption event. Please try again.");
            setIsDecrypting(false);
            clearInterval(interval);
          }
          return newCount;
        });
      }, 6000);

      return () => clearInterval(interval);
    }
  }, [listing, decryption]);

  useEffect(() => {
    const decryptContent = async () => {
      if (!decryption || !provider || !chainConfig || !listing || !medusa) return;
      
      // Reset state when starting a new decryption
      setError(null);
      setPlaintext(null);
      setDownloadLink('');

      try {
        console.log('Downloading encrypted content from storage')
        const storageUrl = getStorageLink(listing.uri)
        
        if (!storageUrl) {
          setError('Invalid storage URL');
          setIsDecrypting(false);
          return;
        }
        
        console.log('Fetching from storage URL:', storageUrl);
        const response = await fetch(storageUrl)
        
        if (!response.ok) {
          setError(`Failed to fetch content: ${response.status} ${response.statusText}`);
          setIsDecrypting(false);
          return;
        }
        
        const encryptedContents = Base64.toUint8Array(await response.text())
        console.log('Successfully fetched encrypted content, decrypting...');

        const decryptedBytes = await medusa.decrypt(
          decryption.ciphertext,
          encryptedContents,
        )
        console.log('Successfully decrypted content');
        
        const msg = new TextDecoder().decode(decryptedBytes)
        setPlaintext(msg)
        
        // Handle different file types
        if (isFile(msg)) {
          console.log('Content is a file');
          const fileData = msg.split(',')[1]
          const mimeType = msg.split(',')[0].split(':')[1].split(';')[0]
          
          // Create proper download link with blob type
          const blob = new Blob([Base64.toUint8Array(fileData)], { type: mimeType })
          setDownloadLink(window.URL.createObjectURL(blob))
        } else {
          console.log('Content is text');
          // For plain text content
          setDownloadLink(window.URL.createObjectURL(new Blob([msg], { type: 'text/plain' })))
        }
        
        setIsDecrypting(false);
      } catch (err) {
        console.error('Error decrypting content:', err);
        setError('Failed to decrypt content. Please try again.');
      }
    };

    if (decryption) {
      decryptContent();
    }
  }, [decryption, listing, isDecrypting, provider, chainConfig, medusa]);

  // Helper function to check if a URI is valid for our storage system
  const isValidStorageUri = (uri: string): boolean => {
    if (!uri || typeof uri !== 'string') return false;
    // Accept any non-IPFS URI as valid for now
    return !uri.startsWith('ipfs://');
  };

  const isFile = (data: string) => {
    return data.startsWith('data:')
  }

  const isImage = (data: string): Boolean => {
    return data.startsWith('data:image')
  }
  
  const isPDF = (data: string): Boolean => {
    return data.startsWith('data:application/pdf')
  }
  
  const determineMimeType = (data: string): string => {
    if (!isFile(data)) return 'text/plain';
    
    try {
      return data.split(',')[0].split(':')[1].split(';')[0];
    } catch (e) {
      console.error('Failed to determine MIME type:', e);
      return 'application/octet-stream';
    }
  }

  if (!listing) {
    return <div>Loading...</div>
  }

  return (
    <div className="p-6 max-w-sm bg-white rounded-lg border border-gray-200 shadow-md dark:bg-gray-800 dark:border-gray-700">
      <h5 className="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white truncate">
        {listing.name}
      </h5>
      <p className="mb-3 font-normal text-gray-700 dark:text-gray-400">
        {listing.description}
      </p>
      <p className="mb-3">
        {BigNumber.from(0).eq(listing.price)
          ? 'Free'
          : `${formatEther(listing.price)} ETH`}{' '}
      </p>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <p>{error}</p>
          <button
            onClick={handleRetry}
            className="mt-2 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
          >
            Try Again
          </button>
          <p className="text-xs mt-1">
            This will check for events from the last hour and restart the waiting process if needed.
          </p>
        </div>
      )}

      {isDecrypting && (
        <div className="p-3 mb-3 bg-blue-100 text-blue-700 rounded-md dark:bg-blue-900 dark:text-blue-100">
          <div className="flex items-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-700 dark:text-blue-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Decrypting content...</span>
          </div>
        </div>
      )}

      {!decryption && !error && (
        <div className="p-3 mb-3 bg-yellow-100 text-yellow-700 rounded-md dark:bg-yellow-900 dark:text-yellow-100">
          <div className="flex items-center">
            <svg className="animate-pulse -ml-1 mr-3 h-5 w-5 text-yellow-700 dark:text-yellow-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Waiting for decryption event from the network... {attemptCount > 0 ? `(${attemptCount}/100)` : ''}</span>
          </div>
          <p className="text-xs mt-1">This may take 1-2 minutes. Please be patient.</p>
        </div>
      )}

      {plaintext ? (
        <div className="mb-4">
          {isImage(plaintext) ? (
            <div className="border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
              <Image
                src={plaintext}
                width={300}
                height={300}
                alt="Decrypted Image"
                className="w-full h-auto"
              />
            </div>
          ) : isPDF(plaintext) ? (
            <div className="border border-gray-300 dark:border-gray-600 rounded-md p-3 flex items-center justify-center bg-gray-50 dark:bg-gray-700">
              <svg className="h-12 w-12 text-red-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                <path fillRule="evenodd" d="M8 10a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1z" clipRule="evenodd" />
                <path d="M8 4a1 1 0 100 2 1 1 0 000-2z" />
              </svg>
              <span className="ml-2 text-gray-700 dark:text-gray-300">PDF Document</span>
            </div>
          ) : isFile(plaintext) ? (
            <div className="border border-gray-300 dark:border-gray-600 rounded-md p-3 flex items-center justify-center bg-gray-50 dark:bg-gray-700">
              <svg className="h-12 w-12 text-blue-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
              <span className="ml-2 text-gray-700 dark:text-gray-300">File: {determineMimeType(plaintext)}</span>
            </div>
          ) : (
            <div className="border border-gray-300 dark:border-gray-600 rounded-md">
              <textarea
                readOnly
                className="form-textarea block w-full p-2 h-24 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-0 focus:ring-0"
                rows={3}
                placeholder="Encrypted Content"
                value={plaintext}
              />
            </div>
          )}
        </div>
      ) : (
        !error && !isDecrypting && decryption && <Signin text="Sign to View" />
      )}

      {downloadLink && (
        <a
          href={downloadLink}
          download={`${listing.name}${getFileExtension(plaintext || '')}`}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          target="_blank"
          rel="noreferrer"
        >
          Download File
          <svg
            className="ml-2 w-5 h-5"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </a>
      )}
    </div>
  )
}

// Helper function to get file extension based on MIME type
const getFileExtension = (data: string): string => {
  if (!data.startsWith('data:')) return '.txt';
  
  try {
    const mimeType = data.split(',')[0].split(':')[1].split(';')[0];
    
    const mimeToExt: {[key: string]: string} = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'application/pdf': '.pdf',
      'text/plain': '.txt',
      'text/html': '.html',
      'application/json': '.json',
    };
    
    return mimeToExt[mimeType] || '';
  } catch (e) {
    console.error('Failed to determine file extension:', e);
    return '';
  }
};

export default Unlocked

