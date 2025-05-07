const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Import Medusa SDK - using relative paths from medusa-app/scripts to medusa-sdk
const medusaSdkPath = path.join(__dirname, '..', '..', 'medusa-sdk');
const { Medusa, Keypair } = require(path.join(medusaSdkPath, 'src'));
const { init } = require(path.join(medusaSdkPath, 'src', 'bn254'));
const { HGamalSuite, Label } = require(path.join(medusaSdkPath, 'src', 'encrypt'));

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
console.log("Medusa SDK Path:", medusaSdkPath);

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

async function main() {
  try {
    // Initialize Medusa SDK
    console.log("Initializing Medusa SDK...");
    const curve = await init();
    
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
    
    // Get the oracle's public key from the contract
    const oraclePublicKey = await onlyFiles.publicKey();
    console.log("Oracle public key from contract:", oraclePublicKey);
    
    // Create a Medusa instance
    const medusa = Medusa.init(provider, ORACLE_ADDRESS);
    
    // Generate a keypair for the buyer
    const buyerKeypair = Medusa.newKeypair(curve);
    console.log("Generated buyer keypair");
    
    // Create a test message to encrypt
    const msgStr = "This is a secret message that will be encrypted and decrypted through Medusa";
    const msgBuff = new TextEncoder().encode(msgStr);
    console.log("Original message:", msgStr);
    
    // Create an encryption suite
    const suite = new HGamalSuite(curve);
    
    // Create a label for encryption
    const label = Label.from(
      medusa.publicKey,
      ONLYFILES_ADDRESS,
      wallet.address
    );
    
    // Encrypt the message
    console.log("Encrypting message...");
    const encryptionResult = await suite.encryptToMedusa(msgBuff, medusa.publicKey, label);
    
    if (encryptionResult.isErr()) {
      throw new Error("Failed to encrypt message: " + encryptionResult.error);
    }
    
    const ciphertext = encryptionResult._unsafeUnwrap();
    console.log("Message encrypted successfully");
    
    // Convert to contract format
    const cipherEVM = ciphertext.encryptedKey.toEvm();
    const contractCipherEVM = {
      random: {
        x: cipherEVM.random.x.toBigInt(),
        y: cipherEVM.random.y.toBigInt()
      },
      cipher: cipherEVM.cipher.toBigInt(),
      random2: {
        x: cipherEVM.random2.x.toBigInt(),
        y: cipherEVM.random2.y.toBigInt()
      },
      dleq: {
        f: cipherEVM.dleq.f.toBigInt(),
        e: cipherEVM.dleq.e.toBigInt()
      }
    };
    
    // Create a listing
    const listingName = "Test Listing";
    const listingDescription = "This is a test listing created by the script";
    const listingPrice = ethers.parseEther("0.01"); // 0.01 ETH
    const listingUri = "test-uri-" + Date.now(); // Unique URI
    
    console.log("\n--- Creating a new listing ---");
    console.log("Listing details:", {
      name: listingName,
      description: listingDescription,
      price: ethers.formatEther(listingPrice),
      uri: listingUri
    });
    
    // Submit the listing
    const submissionFee = BigInt(SUBMISSION_FEE);
    console.log("Submission fee:", ethers.formatEther(submissionFee), "ETH");
    
    console.log("Submitting listing to contract...");
    const createListingTx = await onlyFiles.createListing(
      contractCipherEVM,
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
    
    // Save the encrypted data and ciphertext for later use
    const encryptedData = {
      cipherId: cipherId.toString(),
      encryptedData: Array.from(ciphertext.encryptedData),
      encryptedKey: {
        random: {
          x: cipherEVM.random.x.toString(),
          y: cipherEVM.random.y.toString()
        },
        cipher: cipherEVM.cipher.toString(),
        random2: {
          x: cipherEVM.random2.x.toString(),
          y: cipherEVM.random2.y.toString()
        },
        dleq: {
          f: cipherEVM.dleq.f.toString(),
          e: cipherEVM.dleq.e.toString()
        }
      }
    };
    
    fs.writeFileSync(
      path.join(__dirname, `encrypted-data-${cipherId}.json`),
      JSON.stringify(encryptedData, null, 2)
    );
    console.log(`Encrypted data saved to encrypted-data-${cipherId}.json`);
    
    // Convert buyer's public key to contract format
    const buyerPubkeyContract = {
      x: buyerKeypair.pubkey.toEvm().x.toBigInt(),
      y: buyerKeypair.pubkey.toEvm().y.toBigInt()
    };
    
    // Test scenario 1: Buy the listing with 0 ETH (should fail)
    console.log("\n--- Attempting to buy listing with 0 ETH ---");
    try {
      const buyTx1 = await onlyFiles.buyListing(
        cipherId,
        buyerPubkeyContract,
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
          buyerPubkeyContract,
          { value: listing[1] } // Use the actual listing price from the contract
        );
        
        const buyReceipt2 = await buyTx2.wait();
        console.log("Buy transaction succeeded with listing price:", buyReceipt2.hash);
        
        // Process the transaction receipt for decryption
        await processDecryption(buyReceipt2, cipherId, buyerKeypair, ciphertext, suite);
      } catch (error) {
        console.log("Buy transaction with listing price failed:", error.message);
        
        // Test scenario 3: Buy the listing with listing price + oracle fee
        console.log("\n--- Attempting to buy listing with listing price + oracle fee ---");
        try {
          const oracleFee = BigInt(SUBMISSION_FEE); // Assuming oracle fee is same as submission fee
          const totalValue = listing[1] + oracleFee;
          console.log("Total value:", ethers.formatEther(totalValue), "ETH");
          
          const buyTx3 = await onlyFiles.buyListing(
            cipherId,
            buyerPubkeyContract,
            { value: totalValue }
          );
          
          const buyReceipt3 = await buyTx3.wait();
          console.log("Buy transaction succeeded with listing price + oracle fee:", buyReceipt3.hash);
          
          // Process the transaction receipt for decryption
          await processDecryption(buyReceipt3, cipherId, buyerKeypair, ciphertext, suite);
        } catch (error) {
          console.log("Buy transaction with listing price + oracle fee failed:", error.message);
        }
      }
    }
    
  } catch (error) {
    console.error("Error in main function:", error);
  }
}

async function processDecryption(receipt, cipherId, buyerKeypair, ciphertext, suite) {
  // Find the NewSale event
  const newSaleEvent = receipt.logs
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
    return;
  }
  
  console.log("NewSale event found:", {
    buyer: newSaleEvent.args.buyer,
    seller: newSaleEvent.args.seller,
    requestId: newSaleEvent.args.requestId.toString(),
    cipherId: newSaleEvent.args.cipherId.toString()
  });
  
  // Find the ListingDecryption event
  const decryptionEvent = receipt.logs
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
    return;
  }
  
  console.log("ListingDecryption event found:", {
    requestId: decryptionEvent.args.requestId.toString(),
    reencryptedCipher: decryptionEvent.args.reencryptedCipher
  });
  
  // Convert the reencrypted cipher to the format expected by the SDK
  const reencryptedCipher = {
    random: {
      x: decryptionEvent.args.reencryptedCipher.random.x.toString(),
      y: decryptionEvent.args.reencryptedCipher.random.y.toString()
    }
  };
  
  // Decrypt the data
  console.log("Attempting to decrypt the data...");
  try {
    const decryptedData = await suite.decryptFromMedusa(
      ciphertext.encryptedData,
      buyerKeypair.secret,
      reencryptedCipher
    );
    
    if (decryptedData.isErr()) {
      console.error("Failed to decrypt data:", decryptedData.error);
      return;
    }
    
    const decryptedMessage = new TextDecoder().decode(decryptedData._unsafeUnwrap());
    console.log("Decryption successful!");
    console.log("Decrypted message:", decryptedMessage);
  } catch (error) {
    console.error("Error during decryption:", error);
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  }); 