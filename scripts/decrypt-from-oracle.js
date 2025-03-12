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

// ABI for OnlyFiles contract
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

// ABI for Medusa Oracle contract
const oracleAbi = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "requestId", "type": "uint256" },
      { "indexed": true, "name": "requester", "type": "address" },
      { "indexed": false, "name": "ciphertext", "type": "bytes" }
    ],
    "name": "ReencryptionRequest",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "requestId", "type": "uint256" },
      { "indexed": false, "name": "reencryption", "type": "bytes" }
    ],
    "name": "ReencryptionResponse",
    "type": "event"
  }
];

// Main function
async function main() {
  try {
    // Check if we have the required arguments
    const cipherId = process.argv[2];
    
    if (!cipherId) {
      console.error("Usage: node decrypt-from-oracle.js <cipherId>");
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
    
    // Connect to the contracts
    const onlyFiles = new ethers.Contract(ONLYFILES_ADDRESS, onlyFilesAbi, wallet);
    const oracle = new ethers.Contract(ORACLE_ADDRESS, oracleAbi, wallet);
    
    // Get the current block number
    const currentBlock = await provider.getBlockNumber();
    console.log(`Current block number: ${currentBlock}`);
    
    // Define the block range to search for events
    // We'll look at the last 10000 blocks or from block 0 if the chain is shorter
    const fromBlock = Math.max(0, currentBlock - 10000);
    console.log(`Searching for events from block ${fromBlock} to ${currentBlock}`);
    
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
    
    console.log("\nCiphertext:");
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
    
    // Save the encrypted key data to a file
    const encryptedKeyData = {
      cipherId: cipherId,
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
      }
    };
    
    const encryptedKeyPath = path.join(__dirname, `encrypted-key-${cipherId}.json`);
    fs.writeFileSync(encryptedKeyPath, JSON.stringify(encryptedKeyData, null, 2));
    console.log(`\nEncrypted key data saved to: ${encryptedKeyPath}`);
    
    // Step 2: Check if there are any existing sales for this listing
    console.log("\n=== STEP 2: CHECKING FOR EXISTING SALES ===");
    
    const newSaleFilter = onlyFiles.filters.NewSale(null, null, null, cipherId);
    const newSaleEvents = await onlyFiles.queryFilter(newSaleFilter, fromBlock, currentBlock);
    
    if (newSaleEvents.length === 0) {
      console.log(`No sales found for cipherId: ${cipherId}`);
      console.log("We need to buy the listing first to get the reencrypted cipher.");
      
      // Initialize Medusa SDK to generate a keypair
      console.log("\nInitializing Medusa SDK to generate a keypair...");
      
      // We need to dynamically import the ESM modules
      const { execSync } = require('child_process');
      
      // Create a temporary script to generate a keypair and save it to a file
      const tempScriptPath = path.join(__dirname, 'temp-generate-keypair.js');
      fs.writeFileSync(tempScriptPath, `
        import { init } from '../../medusa-sdk/lib/src/bn254.js';
        import { Medusa } from '../../medusa-sdk/lib/src/index.js';
        import fs from 'fs';
        
        async function generateKeypair() {
          try {
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
          } catch (error) {
            console.error('Error generating keypair:', error);
          }
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
      
      // Get the listing details from the contract
      const listing = await onlyFiles.listings(cipherId);
      const listingPrice = listing[1];
      
      // Buy the listing with listing price + oracle fee
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
        console.error("NewSale event not found in transaction logs");
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
        console.error("ListingDecryption event not found in transaction logs");
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
      
      const reencryptedCipherPath = path.join(__dirname, `reencrypted-cipher-${cipherId}.json`);
      fs.writeFileSync(reencryptedCipherPath, JSON.stringify(reencryptedCipher, null, 2));
      console.log(`Reencrypted cipher saved to: ${reencryptedCipherPath}`);
      
      // Clean up temporary files
      fs.unlinkSync(tempScriptPath);
    } else {
      console.log(`Found ${newSaleEvents.length} sales for cipherId: ${cipherId}`);
      
      // Get the most recent sale
      const mostRecentSale = newSaleEvents[newSaleEvents.length - 1];
      const requestId = mostRecentSale.args.requestId;
      
      console.log("Most recent sale details:");
      console.log(`  Buyer: ${mostRecentSale.args.buyer}`);
      console.log(`  Seller: ${mostRecentSale.args.seller}`);
      console.log(`  Request ID: ${requestId}`);
      console.log(`  Cipher ID: ${mostRecentSale.args.cipherId}`);
      
      // Find the corresponding ListingDecryption event
      const decryptionFilter = onlyFiles.filters.ListingDecryption(requestId);
      const decryptionEvents = await onlyFiles.queryFilter(decryptionFilter, fromBlock, currentBlock);
      
      if (decryptionEvents.length === 0) {
        console.error(`No decryption event found for requestId: ${requestId}`);
        process.exit(1);
      }
      
      const decryptionEvent = decryptionEvents[0];
      console.log("\nDecryption event found:");
      console.log(`  Request ID: ${decryptionEvent.args.requestId}`);
      console.log("  Reencrypted Cipher:");
      console.log("    Random:");
      console.log(`      x: ${decryptionEvent.args.reencryptedCipher.random.x}`);
      console.log(`      y: ${decryptionEvent.args.reencryptedCipher.random.y}`);
      
      // Save the reencrypted cipher to a file
      const reencryptedCipher = {
        random: {
          x: decryptionEvent.args.reencryptedCipher.random.x.toString(),
          y: decryptionEvent.args.reencryptedCipher.random.y.toString()
        }
      };
      
      const reencryptedCipherPath = path.join(__dirname, `reencrypted-cipher-${cipherId}.json`);
      fs.writeFileSync(reencryptedCipherPath, JSON.stringify(reencryptedCipher, null, 2));
      console.log(`Reencrypted cipher saved to: ${reencryptedCipherPath}`);
      
      // We need to generate a keypair for decryption
      console.log("\nGenerating a keypair for decryption...");
      
      // We need to dynamically import the ESM modules
      const { execSync } = require('child_process');
      
      // Create a temporary script to generate a keypair and save it to a file
      const tempScriptPath = path.join(__dirname, 'temp-generate-keypair.js');
      fs.writeFileSync(tempScriptPath, `
        import { init } from '../../medusa-sdk/lib/src/bn254.js';
        import { Medusa } from '../../medusa-sdk/lib/src/index.js';
        import fs from 'fs';
        
        async function generateKeypair() {
          try {
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
          } catch (error) {
            console.error('Error generating keypair:', error);
          }
        }
        
        generateKeypair().catch(console.error);
      `);
      
      // Run the temporary script with Node.js in ESM mode
      console.log("Generating buyer keypair...");
      execSync(`cd ${__dirname} && node --experimental-modules --es-module-specifier-resolution=node temp-generate-keypair.js`, { stdio: 'inherit' });
      
      // Load the generated keypair
      const buyerKeypairData = JSON.parse(fs.readFileSync(path.join(__dirname, 'buyer-keypair.json'), 'utf8'));
      console.log("Buyer keypair loaded");
      
      // Clean up temporary files
      fs.unlinkSync(tempScriptPath);
    }
    
    // Step 3: Try to get the actual encrypted data from the URI
    console.log("\n=== STEP 3: TRYING TO GET ENCRYPTED DATA FROM URI ===");
    
    // Get the listing details from the contract
    const listing = await onlyFiles.listings(cipherId);
    const uri = listing[2];
    
    console.log(`Listing URI: ${uri}`);
    console.log("Note: In a real application, you would fetch the encrypted data from this URI.");
    console.log("For this test, we'll create some dummy encrypted data.");
    
    // Create dummy encrypted data (in a real scenario, this would be fetched from the URI)
    const dummyMessage = "This is a secret message that will be encrypted and decrypted through Medusa";
    const dummyEncryptedData = Array.from(new TextEncoder().encode(dummyMessage));
    
    // Update the encrypted key data with the dummy encrypted data
    const encryptedData = JSON.parse(fs.readFileSync(encryptedKeyPath, 'utf8'));
    encryptedData.encryptedData = dummyEncryptedData;
    
    const encryptedDataPath = path.join(__dirname, `encrypted-data-${cipherId}.json`);
    fs.writeFileSync(encryptedDataPath, JSON.stringify(encryptedData, null, 2));
    console.log(`Encrypted data with dummy content saved to: ${encryptedDataPath}`);
    
    // Step 4: Attempt to decrypt the data
    console.log("\n=== STEP 4: ATTEMPTING TO DECRYPT THE DATA ===");
    
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
    console.log("Running decryption script...");
    execSync(`cd ${__dirname} && node --experimental-modules --es-module-specifier-resolution=node temp-decrypt.js`, { stdio: 'inherit' });
    
    // Clean up temporary files
    fs.unlinkSync(tempDecryptScriptPath);
    
    console.log("\nTest completed!");
    console.log("Note: Since we used dummy encrypted data, the decryption result may not be accurate.");
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