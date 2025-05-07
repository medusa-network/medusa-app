const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Contract addresses from environment
const ONLYFILES_ADDRESS = process.env.NEXT_PUBLIC_ONLYFILES_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_HOLESKY_RPC_URL;

console.log("Environment variables:");
console.log("ONLYFILES_ADDRESS:", ONLYFILES_ADDRESS);
console.log("RPC_URL:", RPC_URL);

// ABI for OnlyFiles contract - with named components
const onlyFilesAbi = [
  {
    "inputs": [{ "name": "cipherId", "type": "uint256" }],
    "name": "listings",
    "outputs": [
      { "name": "seller", "type": "address" },
      { "name": "price", "type": "uint256" },
      { "name": "uri", "type": "string" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "listingCount",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "seller", "type": "address" },
      { "indexed": true, "name": "cipherId", "type": "uint256" },
      {
        "components": [
          {
            "components": [
              { "name": "x", "type": "uint256" },
              { "name": "y", "type": "uint256" }
            ],
            "name": "random",
            "type": "tuple"
          },
          { "name": "cipher", "type": "uint256" },
          {
            "components": [
              { "name": "x", "type": "uint256" },
              { "name": "y", "type": "uint256" }
            ],
            "name": "random2",
            "type": "tuple"
          },
          {
            "components": [
              { "name": "f", "type": "uint256" },
              { "name": "e", "type": "uint256" }
            ],
            "name": "dleq",
            "type": "tuple"
          }
        ],
        "indexed": false,
        "name": "ciphertext",
        "type": "tuple"
      },
      { "indexed": false, "name": "name", "type": "string" },
      { "indexed": false, "name": "description", "type": "string" },
      { "indexed": false, "name": "price", "type": "uint256" },
      { "indexed": false, "name": "uri", "type": "string" }
    ],
    "name": "NewListing",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "buyer", "type": "address" },
      { "indexed": true, "name": "seller", "type": "address" },
      { "indexed": false, "name": "requestId", "type": "uint256" },
      { "indexed": false, "name": "cipherId", "type": "uint256" }
    ],
    "name": "NewSale",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "requestId", "type": "uint256" },
      {
        "components": [
          {
            "components": [
              { "name": "x", "type": "uint256" },
              { "name": "y", "type": "uint256" }
            ],
            "name": "random",
            "type": "tuple"
          }
        ],
        "indexed": false,
        "name": "reencryptedCipher",
        "type": "tuple"
      }
    ],
    "name": "ListingDecryption",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "publicKey",
    "outputs": [
      {
        "components": [
          { "name": "x", "type": "uint256" },
          { "name": "y", "type": "uint256" }
        ],
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Main function
async function main() {
  try {
    // Connect to the provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    console.log("Connected to network:", await provider.getNetwork());
    
    // Connect to the contract
    const onlyFiles = new ethers.Contract(ONLYFILES_ADDRESS, onlyFilesAbi, provider);
    
    // Get the current block number
    const currentBlock = await provider.getBlockNumber();
    console.log(`Current block number: ${currentBlock}`);
    
    // Define the block range to search for events
    // We'll look at the last 10000 blocks or from block 0 if the chain is shorter
    const fromBlock = Math.max(0, currentBlock - 10000);
    console.log(`Searching for events from block ${fromBlock} to ${currentBlock}`);
    
    // Query for NewListing events
    console.log("\n=== QUERYING FOR NEWLISTING EVENTS ===");
    const newListingFilter = onlyFiles.filters.NewListing();
    const newListingEvents = await onlyFiles.queryFilter(newListingFilter, fromBlock, currentBlock);
    
    console.log(`Found ${newListingEvents.length} NewListing events`);
    
    if (newListingEvents.length === 0) {
      console.log("No listings found in the specified block range.");
      return;
    }
    
    // Sort events by block number (descending) to get the most recent first
    newListingEvents.sort((a, b) => b.blockNumber - a.blockNumber);
    
    // Display the most recent 5 listings (or fewer if there are less than 5)
    const displayCount = Math.min(5, newListingEvents.length);
    console.log(`\nDisplaying the ${displayCount} most recent listings:`);
    
    for (let i = 0; i < displayCount; i++) {
      const event = newListingEvents[i];
      const cipherId = event.args.cipherId;
      
      console.log(`\nListing #${cipherId} (Block: ${event.blockNumber}):`);
      console.log(`  Seller: ${event.args.seller}`);
      console.log(`  Name: ${event.args.name}`);
      console.log(`  Description: ${event.args.description}`);
      console.log(`  Price: ${ethers.formatEther(event.args.price)} ETH`);
      console.log(`  URI: ${event.args.uri}`);
      
      // Save the ciphertext for the most recent listing
      if (i === 0) {
        const mostRecentCipherId = cipherId;
        const ciphertext = event.args.ciphertext;
        
        console.log("\n=== MOST RECENT LISTING DETAILS ===");
        console.log(`CipherId: ${mostRecentCipherId}`);
        console.log("Ciphertext:");
        console.log("  Random:");
        console.log(`    x: ${ciphertext.random.x}`);
        console.log(`    y: ${ciphertext.random.y}`);
        console.log(`  Cipher: ${ciphertext.cipher}`);
        console.log("  Random2:");
        console.log(`    x: ${ciphertext.random2.x}`);
        console.log(`    y: ${ciphertext.random2.y}`);
        console.log("  DLEQ:");
        console.log(`    f: ${ciphertext.dleq.f}`);
        console.log(`    e: ${ciphertext.dleq.e}`);
        
        // Get the oracle's public key
        const oraclePublicKey = await onlyFiles.publicKey();
        console.log("\nOracle Public Key:");
        console.log(`  x: ${oraclePublicKey[0]}`);
        console.log(`  y: ${oraclePublicKey[1]}`);
        
        // Save the encrypted data to a file for later decryption
        const encryptedData = {
          cipherId: mostRecentCipherId.toString(),
          encryptedKey: {
            random: {
              x: ciphertext.random.x.toString(),
              y: ciphertext.random.y.toString()
            },
            cipher: ciphertext.cipher.toString(),
            random2: {
              x: ciphertext.random2.x.toString(),
              y: ciphertext.random2.y.toString()
            },
            dleq: {
              f: ciphertext.dleq.f.toString(),
              e: ciphertext.dleq.e.toString()
            }
          },
          // Note: We don't have the actual encrypted data from the event
          // This is just a placeholder - in a real scenario, we would need to retrieve this separately
          encryptedData: []
        };
        
        const encryptedDataPath = path.join(__dirname, `latest-listing-${mostRecentCipherId}.json`);
        fs.writeFileSync(encryptedDataPath, JSON.stringify(encryptedData, null, 2));
        console.log(`\nEncrypted key data saved to: ${encryptedDataPath}`);
        
        console.log("\nTo test buying and decrypting this listing, run:");
        console.log(`node simple-test.js ${mostRecentCipherId}`);
        console.log("\nNote: Since we don't have the actual encrypted data from the event,");
        console.log("we won't be able to fully decrypt the content after purchase.");
        console.log("This is just a demonstration of the buying process.");
      }
    }
    
    // Query for NewSale events
    console.log("\n=== QUERYING FOR NEWSALE EVENTS ===");
    const newSaleFilter = onlyFiles.filters.NewSale();
    const newSaleEvents = await onlyFiles.queryFilter(newSaleFilter, fromBlock, currentBlock);
    
    console.log(`Found ${newSaleEvents.length} NewSale events`);
    
    if (newSaleEvents.length > 0) {
      // Display the most recent 5 sales (or fewer if there are less than 5)
      const displayCount = Math.min(5, newSaleEvents.length);
      console.log(`\nDisplaying the ${displayCount} most recent sales:`);
      
      for (let i = 0; i < displayCount; i++) {
        const event = newSaleEvents[i];
        console.log(`\nSale (Block: ${event.blockNumber}):`);
        console.log(`  Buyer: ${event.args.buyer}`);
        console.log(`  Seller: ${event.args.seller}`);
        console.log(`  Request ID: ${event.args.requestId}`);
        console.log(`  Cipher ID: ${event.args.cipherId}`);
      }
    }
    
    // Query for ListingDecryption events
    console.log("\n=== QUERYING FOR LISTINGDECRYPTION EVENTS ===");
    const decryptionFilter = onlyFiles.filters.ListingDecryption();
    const decryptionEvents = await onlyFiles.queryFilter(decryptionFilter, fromBlock, currentBlock);
    
    console.log(`Found ${decryptionEvents.length} ListingDecryption events`);
    
    if (decryptionEvents.length > 0) {
      // Display the most recent 5 decryptions (or fewer if there are less than 5)
      const displayCount = Math.min(5, decryptionEvents.length);
      console.log(`\nDisplaying the ${displayCount} most recent decryptions:`);
      
      for (let i = 0; i < displayCount; i++) {
        const event = decryptionEvents[i];
        console.log(`\nDecryption (Block: ${event.blockNumber}):`);
        console.log(`  Request ID: ${event.args.requestId}`);
        console.log("  Reencrypted Cipher:");
        console.log("    Random:");
        console.log(`      x: ${event.args.reencryptedCipher.random.x}`);
        console.log(`      y: ${event.args.reencryptedCipher.random.y}`);
      }
    }
    
  } catch (error) {
    console.error("Error in main function:", error);
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  }); 