const { ethers } = require('ethers');
const fs = require('fs');
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
        "name": "cipher",
        "type": "tuple"
      },
      { "name": "name", "type": "string" },
      { "name": "description", "type": "string" },
      { "name": "price", "type": "uint256" },
      { "name": "uri", "type": "string" }
    ],
    "name": "createListing",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "payable",
    "type": "function"
  },
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
  }
];

// ABI for Oracle contract
const oracleAbi = [
  {
    "inputs": [],
    "name": "distributedKey",
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

async function main() {
  try {
    // Connect to the provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    console.log("Connected to network:", await provider.getNetwork());
    
    // Create wallet from private key
    // WARNING: Never hardcode private keys in production code
    // For testing, you can use a .env file or pass as command line argument
    if (!process.env.PRIVATE_KEY) {
      console.error("Please set PRIVATE_KEY in your environment");
      process.exit(1);
    }
    
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log("Using wallet address:", wallet.address);
    
    // Connect to the contracts
    const onlyFiles = new ethers.Contract(ONLYFILES_ADDRESS, onlyFilesAbi, wallet);
    const oracle = new ethers.Contract(ORACLE_ADDRESS, oracleAbi, provider);
    
    // Get the oracle's public key
    const oraclePublicKey = await onlyFiles.publicKey();
    console.log("Oracle public key:", oraclePublicKey);
    
    // Create a dummy buyer public key (this would normally come from the Medusa SDK)
    // For testing, we'll use a hardcoded value that matches the G1Point format
    const buyerPublicKey = {
      x: "0x1234567890123456789012345678901234567890123456789012345678901234",
      y: "0x5678901234567890123456789012345678901234567890123456789012345678"
    };
    
    // Test scenario 1: Create a new listing
    const listingName = "Test Listing";
    const listingDescription = "This is a test listing created by the script";
    const listingPrice = ethers.parseEther("0.01"); // 0.01 ETH
    const listingUri = "test-uri-" + Date.now(); // Unique URI
    
    // Create a dummy ciphertext (this would normally come from the Medusa SDK)
    // For testing, we'll use hardcoded values that match the Ciphertext format
    const dummyCiphertext = {
      random: {
        x: "0x1111111111111111111111111111111111111111111111111111111111111111",
        y: "0x2222222222222222222222222222222222222222222222222222222222222222"
      },
      cipher: "0x3333333333333333333333333333333333333333333333333333333333333333",
      random2: {
        x: "0x4444444444444444444444444444444444444444444444444444444444444444",
        y: "0x5555555555555555555555555555555555555555555555555555555555555555"
      },
      dleq: {
        f: "0x6666666666666666666666666666666666666666666666666666666666666666",
        e: "0x7777777777777777777777777777777777777777777777777777777777777777"
      }
    };
    
    console.log("\n--- Creating a new listing ---");
    console.log("Listing details:", {
      name: listingName,
      description: listingDescription,
      price: listingPrice.toString(),
      uri: listingUri
    });
    
    // Submit the listing
    const submissionFee = BigInt(SUBMISSION_FEE);
    console.log("Submission fee:", ethers.formatEther(submissionFee), "ETH");
    
    const createListingTx = await onlyFiles.createListing(
      dummyCiphertext,
      listingName,
      listingDescription,
      listingPrice,
      listingUri,
      { value: submissionFee }
    );
    
    console.log("Transaction sent:", createListingTx.hash);
    console.log("Waiting for transaction confirmation...");
    
    const createListingReceipt = await createListingTx.wait();
    console.log("Transaction confirmed in block:", createListingReceipt.blockNumber);
    
    // Find the NewListing event to get the cipherId
    const newListingEvent = createListingReceipt.logs
      .map(log => {
        try {
          return onlyFiles.interface.parseLog(log);
        } catch (e) {
          return null;
        }
      })
      .find(event => event && event.name === "NewListing");
    
    if (!newListingEvent) {
      throw new Error("NewListing event not found in transaction logs");
    }
    
    const cipherId = newListingEvent.args.cipherId;
    console.log("Listing created with cipherId:", cipherId);
    
    // Get the listing details
    const listing = await onlyFiles.listings(cipherId);
    console.log("Listing details:", {
      seller: listing[0],
      price: ethers.formatEther(listing[1]),
      uri: listing[2]
    });
    
    // Test scenario 2: Buy the listing as the owner (should fail with 0 ETH)
    console.log("\n--- Attempting to buy listing as owner with 0 ETH ---");
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
      
      // Test scenario 3: Buy the listing as the owner with just the listing price
      console.log("\n--- Attempting to buy listing as owner with listing price ---");
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
        
        // Test scenario 4: Buy the listing as the owner with listing price + oracle fee
        console.log("\n--- Attempting to buy listing as owner with listing price + oracle fee ---");
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