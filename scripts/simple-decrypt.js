// Import required libraries
const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');

// Import Medusa SDK directly
const { init } = require('../../medusa-sdk/lib/src/bn254');
const { HGamalSuite } = require('../../medusa-sdk/lib/src/encrypt');
const { Scalar } = require('../../medusa-sdk/lib/src/algebra');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Contract addresses from environment
const ONLYFILES_ADDRESS = process.env.NEXT_PUBLIC_ONLYFILES_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_HOLESKY_RPC_URL;

// ABI for OnlyFiles contract (minimal required for our task)
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
  }
];

// Main function
async function main() {
  try {
    // Check if we have the required arguments
    const cipherId = process.argv[2];
    
    if (!cipherId) {
      console.error("Usage: node simple-decrypt.js <cipherId>");
      process.exit(1);
    }
    
    console.log(`Attempting to decrypt listing with cipherId: ${cipherId}`);
    
    // Connect to the provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    console.log("Connected to network:", await provider.getNetwork());
    
    // Connect to the contract (read-only)
    const onlyFiles = new ethers.Contract(ONLYFILES_ADDRESS, onlyFilesAbi, provider);
    
    // Get the current block number
    const currentBlock = await provider.getBlockNumber();
    console.log(`Current block number: ${currentBlock}`);
    
    // Define the block range to search for events (last 10000 blocks)
    const fromBlock = Math.max(0, currentBlock - 10000);
    
    // Step 1: Get the listing details and ciphertext
    console.log("\n=== STEP 1: GETTING LISTING DETAILS ===");
    
    // Query for NewListing events for the specific cipherId
    const newListingFilter = onlyFiles.filters.NewListing(null, cipherId);
    const newListingEvents = await onlyFiles.queryFilter(newListingFilter, fromBlock, currentBlock);
    
    if (newListingEvents.length === 0) {
      console.error(`No listing found with cipherId: ${cipherId}`);
      process.exit(1);
    }
    
    const listingEvent = newListingEvents[0];
    const ciphertext = listingEvent.args.ciphertext;
    
    console.log("Listing details:");
    console.log(`  Seller: ${listingEvent.args.seller}`);
    console.log(`  Name: ${listingEvent.args.name}`);
    console.log(`  Description: ${listingEvent.args.description}`);
    console.log(`  Price: ${ethers.formatEther(listingEvent.args.price)} ETH`);
    console.log(`  URI: ${listingEvent.args.uri}`);
    
    // Step 2: Find a decryption event for this listing
    console.log("\n=== STEP 2: FINDING DECRYPTION EVENT ===");
    
    // Query for ListingDecryption events
    const decryptionEvents = await onlyFiles.queryFilter(onlyFiles.filters.ListingDecryption(), fromBlock, currentBlock);
    
    // Find a decryption event that matches our listing
    // Note: In a real app, we would match this by requestId from a NewSale event
    // For simplicity, we'll just use the most recent decryption event
    if (decryptionEvents.length === 0) {
      console.error("No decryption events found. The listing may not have been purchased yet.");
      process.exit(1);
    }
    
    const decryptionEvent = decryptionEvents[decryptionEvents.length - 1];
    console.log("Found decryption event:");
    console.log(`  Request ID: ${decryptionEvent.args.requestId}`);
    console.log("  Reencrypted Cipher:");
    console.log("    Random:");
    console.log(`      x: ${decryptionEvent.args.reencryptedCipher.random.x}`);
    console.log(`      y: ${decryptionEvent.args.reencryptedCipher.random.y}`);
    
    // Step 3: Generate a keypair for decryption
    console.log("\n=== STEP 3: GENERATING KEYPAIR ===");
    
    // Initialize the curve
    const curve = await init();
    console.log("Initialized curve");
    
    // Generate a keypair
    const secret = Scalar.random();
    console.log("Generated secret key");
    
    // Step 4: Create dummy encrypted data
    console.log("\n=== STEP 4: CREATING TEST DATA ===");
    
    // In a real app, this would be fetched from the URI
    const dummyMessage = "This is a secret message that will be encrypted and decrypted through Medusa";
    const encryptedData = new Uint8Array(new TextEncoder().encode(dummyMessage));
    console.log(`Created dummy encrypted data (${encryptedData.length} bytes)`);
    
    // Step 5: Attempt to decrypt
    console.log("\n=== STEP 5: ATTEMPTING DECRYPTION ===");
    
    // Create the encryption suite
    const suite = new HGamalSuite(curve);
    console.log("Created encryption suite");
    
    // Format the reencrypted cipher
    const reencryptedCipher = {
      random: {
        x: decryptionEvent.args.reencryptedCipher.random.x.toString(),
        y: decryptionEvent.args.reencryptedCipher.random.y.toString()
      }
    };
    
    // Attempt to decrypt
    console.log("Attempting to decrypt...");
    try {
      const decryptionResult = await suite.decryptFromMedusa(
        encryptedData,
        secret,
        reencryptedCipher
      );
      
      if (decryptionResult.isErr()) {
        console.error("Decryption failed:", decryptionResult.error);
      } else {
        const decryptedData = decryptionResult._unsafeUnwrap();
        const decryptedMessage = new TextDecoder().decode(decryptedData);
        
        console.log("Decryption successful!");
        console.log("Decrypted message:", decryptedMessage);
      }
    } catch (error) {
      console.error("Error during decryption:", error);
    }
    
    console.log("\nTest completed!");
    console.log("Note: Since we used dummy encrypted data, the decryption result is just a demonstration.");
    console.log("In a real application, you would need to fetch the actual encrypted data from the URI.");
    
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