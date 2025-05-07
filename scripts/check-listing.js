const { ethers } = require('ethers');
const path = require('path');
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
  }
];

// Main function
async function main() {
  try {
    // Check if we have the required arguments
    const cipherId = process.argv[2];
    
    if (!cipherId) {
      console.error("Usage: node check-listing.js <cipherId>");
      process.exit(1);
    }
    
    // Connect to the provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    console.log("Connected to network:", await provider.getNetwork());
    
    // Connect to the contract
    const onlyFiles = new ethers.Contract(ONLYFILES_ADDRESS, onlyFilesAbi, provider);
    
    // Get the listing details
    try {
      const listing = await onlyFiles.listings(cipherId);
      console.log(`\nListing #${cipherId}:`);
      console.log(`  Seller: ${listing[0]}`);
      console.log(`  Price: ${ethers.formatEther(listing[1])} ETH`);
      console.log(`  URI: ${listing[2]}`);
      
      console.log("\nTo test buying this listing, run:");
      console.log(`node simple-test.js ${cipherId}`);
    } catch (error) {
      console.log(`\nListing #${cipherId}: Error retrieving listing - ${error.message}`);
      console.log("This listing may not exist or there might be an issue with the contract.");
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