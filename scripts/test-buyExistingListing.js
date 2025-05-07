const { ethers } = require('ethers');
const path = require('path');
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
  }
];

async function main() {
  try {
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
    
    // Get the oracle's public key
    const oraclePublicKey = await onlyFiles.publicKey();
    console.log("Oracle public key:", oraclePublicKey);
    
    // Create a buyer public key (this would normally come from the Medusa SDK)
    // For testing, we'll use a hardcoded value that matches the G1Point format
    const buyerPublicKey = {
      x: "0x1234567890123456789012345678901234567890123456789012345678901234",
      y: "0x5678901234567890123456789012345678901234567890123456789012345678"
    };
    
    // Use an existing listing ID
    // You can replace this with an actual listing ID from your contract
    const cipherId = process.argv[2];
    if (!cipherId) {
      console.error("Please provide a cipherId as a command line argument");
      process.exit(1);
    }
    
    console.log(`Testing with cipherId: ${cipherId}`);
    
    // Get the listing details
    try {
      const listing = await onlyFiles.listings(cipherId);
      console.log("Listing details:", {
        seller: listing[0],
        price: ethers.formatEther(listing[1]),
        uri: listing[2]
      });
      
      const isOwner = listing[0].toLowerCase() === wallet.address.toLowerCase();
      console.log("Is wallet the owner of this listing?", isOwner);
      
      const listingPrice = listing[1];
      
      // Test scenario 1: Buy the listing with 0 ETH (should fail)
      console.log("\n--- Attempting to buy listing with 0 ETH ---");
      try {
        const buyTx1 = await onlyFiles.buyListing(
          cipherId,
          buyerPublicKey,
          { value: ethers.parseEther("0") }
        );
        
        const buyReceipt1 = await buyTx1.wait();
        console.log("Buy transaction succeeded with 0 ETH (unexpected):", buyReceipt1.hash);
      } catch (error) {
        console.log("Buy transaction with 0 ETH failed as expected:", error.message);
        
        // Test scenario 2: Buy the listing with just the listing price
        console.log("\n--- Attempting to buy listing with listing price ---");
        try {
          const buyTx2 = await onlyFiles.buyListing(
            cipherId,
            buyerPublicKey,
            { value: listingPrice }
          );
          
          const buyReceipt2 = await buyTx2.wait();
          console.log("Buy transaction succeeded with listing price:", buyReceipt2.hash);
        } catch (error) {
          console.log("Buy transaction with listing price failed:", error.message);
          
          // Test scenario 3: Buy the listing with listing price + oracle fee
          console.log("\n--- Attempting to buy listing with listing price + oracle fee ---");
          try {
            const oracleFee = BigInt(SUBMISSION_FEE); // Assuming oracle fee is same as submission fee
            const totalValue = listingPrice + oracleFee;
            console.log("Total value:", ethers.formatEther(totalValue), "ETH");
            
            const buyTx3 = await onlyFiles.buyListing(
              cipherId,
              buyerPublicKey,
              { value: totalValue }
            );
            
            const buyReceipt3 = await buyTx3.wait();
            console.log("Buy transaction succeeded with listing price + oracle fee:", buyReceipt3.hash);
            
            // Find the NewSale event
            const newSaleEvent = buyReceipt3.logs
              .map(log => {
                try {
                  return onlyFiles.interface.parseLog(log);
                } catch (e) {
                  return null;
                }
              })
              .find(event => event && event.name === "NewSale");
            
            if (newSaleEvent) {
              console.log("NewSale event found:", {
                buyer: newSaleEvent.args.buyer,
                seller: newSaleEvent.args.seller,
                requestId: newSaleEvent.args.requestId.toString(),
                cipherId: newSaleEvent.args.cipherId.toString()
              });
            }
          } catch (error) {
            console.log("Buy transaction with listing price + oracle fee failed:", error.message);
          }
        }
      }
    } catch (error) {
      console.error("Error getting listing details:", error.message);
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