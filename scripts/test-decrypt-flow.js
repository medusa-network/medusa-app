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
    const encryptedDataPath = process.argv[3];
    
    if (!cipherId || !encryptedDataPath) {
      console.error("Usage: node test-decrypt-flow.js <cipherId> <path-to-encrypted-data-json>");
      process.exit(1);
    }
    
    console.log(`Testing with cipherId: ${cipherId}`);
    console.log(`Using encrypted data from: ${encryptedDataPath}`);
    
    // Load the encrypted data
    let encryptedData;
    try {
      const encryptedDataJson = fs.readFileSync(encryptedDataPath, 'utf8');
      encryptedData = JSON.parse(encryptedDataJson);
      console.log("Loaded encrypted data successfully");
    } catch (error) {
      console.error("Failed to load encrypted data:", error.message);
      process.exit(1);
    }
    
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
    
    // Initialize Medusa SDK
    console.log("Initializing Medusa SDK...");
    
    // We need to dynamically import the ESM modules
    const { execSync } = require('child_process');
    
    // Create a temporary script to generate a keypair and save it to a file
    const tempScriptPath = path.join(__dirname, 'temp-generate-keypair.js');
    fs.writeFileSync(tempScriptPath, `
      import { init } from '../../medusa-sdk/lib/src/bn254.js';
      import { Medusa } from '../../medusa-sdk/lib/src/index.js';
      import fs from 'fs';
      
      async function generateKeypair() {
        const curve = await init();
        const buyerKeypair = Medusa.newKeypair(curve);
        
        // Convert to a format that can be serialized
        const keypairData = {
          pubkey: {
            x: buyerKeypair.pubkey.toEvm().x.toString(),
            y: buyerKeypair.pubkey.toEvm().y.toString()
          },
          secret: buyerKeypair.secret.toString()
        };
        
        fs.writeFileSync('buyer-keypair.json', JSON.stringify(keypairData, null, 2));
        console.log('Keypair generated and saved to buyer-keypair.json');
        
        // Also output the contract format for the public key
        const pubkeyContract = {
          x: buyerKeypair.pubkey.toEvm().x.toString(),
          y: buyerKeypair.pubkey.toEvm().y.toString()
        };
        
        fs.writeFileSync('buyer-pubkey-contract.json', JSON.stringify(pubkeyContract, null, 2));
        console.log('Public key in contract format saved to buyer-pubkey-contract.json');
      }
      
      generateKeypair().catch(console.error);
    `);
    
    // Run the temporary script with Node.js in ESM mode
    console.log("Generating buyer keypair...");
    execSync(`cd ${__dirname} && node --experimental-modules --es-module-specifier-resolution=node temp-generate-keypair.js`, { stdio: 'inherit' });
    
    // Load the generated keypair and public key in contract format
    const buyerKeypairData = JSON.parse(fs.readFileSync(path.join(__dirname, 'buyer-keypair.json'), 'utf8'));
    const buyerPubkeyContract = JSON.parse(fs.readFileSync(path.join(__dirname, 'buyer-pubkey-contract.json'), 'utf8'));
    
    console.log("Buyer keypair loaded");
    console.log("Public key in contract format:", buyerPubkeyContract);
    
    // Test buying the listing with different ETH amounts
    const listingPrice = listing[1];
    
    // Test scenario 1: Buy the listing with listing price + oracle fee
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
    
    // Create a temporary script to decrypt the data
    const tempDecryptScriptPath = path.join(__dirname, 'temp-decrypt.js');
    fs.writeFileSync(tempDecryptScriptPath, `
      import { init } from '../../medusa-sdk/lib/src/bn254.js';
      import { HGamalSuite } from '../../medusa-sdk/lib/src/encrypt.js';
      import { Scalar } from '../../medusa-sdk/lib/src/algebra.js';
      import fs from 'fs';
      
      async function decryptData() {
        try {
          // Load the encrypted data
          const encryptedData = JSON.parse(fs.readFileSync('${encryptedDataPath}', 'utf8'));
          console.log('Loaded encrypted data');
          
          // Load the buyer keypair
          const buyerKeypair = JSON.parse(fs.readFileSync('buyer-keypair.json', 'utf8'));
          console.log('Loaded buyer keypair');
          
          // Load the reencrypted cipher
          const reencryptedCipher = JSON.parse(fs.readFileSync('reencrypted-cipher-${cipherId}.json', 'utf8'));
          console.log('Loaded reencrypted cipher');
          
          // Initialize the curve
          const curve = await init();
          console.log('Initialized curve');
          
          // Create the encryption suite
          const suite = new HGamalSuite(curve);
          console.log('Created encryption suite');
          
          // Check if we have encrypted data
          if (!encryptedData.encryptedData || encryptedData.encryptedData.length === 0) {
            console.error('No encrypted data found in the file. This may be because:');
            console.error('1. The encrypted data was not included in the event');
            console.error('2. The encrypted data is stored elsewhere (e.g., IPFS)');
            console.error('3. The encrypted data was not properly saved');
            console.error('Without the encrypted data, we cannot proceed with decryption.');
            return;
          }
          
          // Convert the encrypted data to the right format
          const encryptedDataArray = new Uint8Array(encryptedData.encryptedData);
          console.log('Converted encrypted data to Uint8Array, length:', encryptedDataArray.length);
          
          // Convert the buyer secret key to a Scalar
          const buyerSecret = Scalar.fromString(buyerKeypair.secret);
          console.log('Converted buyer secret key to Scalar');
          
          // Decrypt the data
          console.log('Attempting to decrypt...');
          const decryptionResult = await suite.decryptFromMedusa(
            encryptedDataArray,
            buyerSecret,
            reencryptedCipher
          );
          
          if (decryptionResult.isErr()) {
            console.error('Decryption failed:', decryptionResult.error);
            return;
          }
          
          const decryptedData = decryptionResult._unsafeUnwrap();
          const decryptedMessage = new TextDecoder().decode(decryptedData);
          
          console.log('Decryption successful!');
          console.log('Decrypted message:', decryptedMessage);
          
          // Save the decrypted message to a file
          fs.writeFileSync('decrypted-message-${cipherId}.txt', decryptedMessage);
          console.log('Decrypted message saved to decrypted-message-${cipherId}.txt');
        } catch (error) {
          console.error('Error during decryption:', error);
        }
      }
      
      decryptData().catch(console.error);
    `);
    
    // Run the temporary script with Node.js in ESM mode
    console.log("\n--- Attempting to decrypt the data ---");
    execSync(`cd ${__dirname} && node --experimental-modules --es-module-specifier-resolution=node temp-decrypt.js`, { stdio: 'inherit' });
    
    // Clean up temporary files
    fs.unlinkSync(tempScriptPath);
    fs.unlinkSync(tempDecryptScriptPath);
    
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