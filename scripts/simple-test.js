const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Contract addresses from environment
const ONLYFILES_ADDRESS = process.env.NEXT_PUBLIC_ONLYFILES_ADDRESS;
const ORACLE_ADDRESS = process.env.NEXT_PUBLIC_ORACLE_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_HOLESKY_RPC_URL;
const SUBMISSION_FEE = process.env.NEXT_PUBLIC_SUBMISSION_FEE || "100000000000000"; // 0.0001 ETH

console.log("Environment variables:");
console.log("ONLYFILES_ADDRESS:", ONLYFILES_ADDRESS);
console.log("ORACLE_ADDRESS:", ORACLE_ADDRESS);
console.log("RPC_URL:", RPC_URL);
console.log("SUBMISSION_FEE:", SUBMISSION_FEE);

// ABI for OnlyFiles contract - with named components
const onlyFilesAbi = [
  {
    "inputs": [
      { "name": "cipherId", "type": "uint256" },
      {
        "components": [
          { "name": "x", "type": "uint256" },
          { "name": "y", "type": "uint256" }
        ],
        "name": "buyerPublicKey",
        "type": "tuple"
      }
    ],
    "name": "buyListing",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "payable",
    "type": "function"
  },
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
  }
];

// Main function
async function main() {
  try {
    // Check if we have the required arguments
    const cipherId = process.argv[2];
    
    if (!cipherId) {
      console.error("Usage: node simple-test.js <cipherId>");
      process.exit(1);
    }
    
    console.log(`Testing with cipherId: ${cipherId}`);
    
    // Connect to the provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    console.log("Connected to network:", await provider.getNetwork());
    
    // Create wallet from private key
    if (!process.env.PRIVATE_KEY) {
      console.error("Please set PRIVATE_KEY in your environment");
      process.exit(1);
    }
    
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log("Using wallet address:", wallet.address);
    
    // Connect to the contract
    const onlyFiles = new ethers.Contract(ONLYFILES_ADDRESS, onlyFilesAbi, wallet);
    
    // Get the listing details
    const listing = await onlyFiles.listings(cipherId);
    console.log("Listing details:", {
      seller: listing[0],
      price: ethers.formatEther(listing[1]),
      uri: listing[2]
    });
    
    const isOwner = listing[0].toLowerCase() === wallet.address.toLowerCase();
    console.log("Is wallet the owner of this listing?", isOwner);
    
    // Create a simple buyer public key (this is just for testing)
    const buyerPubkeyContract = {
      x: "21888242871839275222246405745257275088696311157297823662689037894645226208582",
      y: "21888242871839275222246405745257275088696311157297823662689037894645226208583"
    };
    
    console.log("Using test buyer public key:", buyerPubkeyContract);
    
    // Test buying the listing with different ETH amounts
    const listingPrice = listing[1];
    
    // Test scenario: Buy the listing with listing price + oracle fee
    console.log("\n--- Attempting to buy listing with listing price + oracle fee ---");
    const oracleFee = BigInt(SUBMISSION_FEE); // Assuming oracle fee is same as submission fee
    const totalValue = listingPrice + oracleFee;
    console.log("Total value:", ethers.formatEther(totalValue), "ETH");
    
    const buyTx = await onlyFiles.buyListing(
      cipherId,
      buyerPubkeyContract,
      { value: totalValue }
    );
    
    console.log("Transaction sent:", buyTx.hash);
    console.log("Waiting for transaction confirmation...");
    
    const buyReceipt = await buyTx.wait();
    console.log("Transaction confirmed in block:", buyReceipt.blockNumber);
    
    // Find the NewSale event
    const newSaleEvent = buyReceipt.logs
      .map(log => {
        try {
          return onlyFiles.interface.parseLog(log);
        } catch (e) {
          return null;
        }
      })
      .find(event => event && event.name === "NewSale");
    
    if (!newSaleEvent) {
      console.log("NewSale event not found in transaction logs");
      process.exit(1);
    }
    
    console.log("NewSale event found:", {
      buyer: newSaleEvent.args.buyer,
      seller: newSaleEvent.args.seller,
      requestId: newSaleEvent.args.requestId.toString(),
      cipherId: newSaleEvent.args.cipherId.toString()
    });
    
    // Find the ListingDecryption event
    const decryptionEvent = buyReceipt.logs
      .map(log => {
        try {
          return onlyFiles.interface.parseLog(log);
        } catch (e) {
          return null;
        }
      })
      .find(event => event && event.name === "ListingDecryption");
    
    if (!decryptionEvent) {
      console.log("ListingDecryption event not found in transaction logs");
      process.exit(1);
    }
    
    console.log("ListingDecryption event found:", {
      requestId: decryptionEvent.args.requestId.toString(),
      reencryptedCipher: {
        random: {
          x: decryptionEvent.args.reencryptedCipher.random.x.toString(),
          y: decryptionEvent.args.reencryptedCipher.random.y.toString()
        }
      }
    });
    
    // Save the reencrypted cipher to a file
    const reencryptedCipher = {
      random: {
        x: decryptionEvent.args.reencryptedCipher.random.x.toString(),
        y: decryptionEvent.args.reencryptedCipher.random.y.toString()
      }
    };
    
    fs.writeFileSync(
      path.join(__dirname, `reencrypted-cipher-${cipherId}.json`),
      JSON.stringify(reencryptedCipher, null, 2)
    );
    console.log(`Reencrypted cipher saved to reencrypted-cipher-${cipherId}.json`);
    
    console.log("\nTest completed successfully!");
    
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