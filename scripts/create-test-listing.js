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
  }
];

// Main function
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
    
    // Get the oracle's public key from the contract
    const oraclePublicKey = await onlyFiles.publicKey();
    console.log("Oracle public key from contract:", oraclePublicKey);
    
    // Initialize Medusa SDK
    console.log("Initializing Medusa SDK...");
    
    // We need to dynamically import the ESM modules
    const { execSync } = require('child_process');
    
    // Create a temporary script to encrypt a message and save it to a file
    const tempScriptPath = path.join(__dirname, 'temp-encrypt.js');
    fs.writeFileSync(tempScriptPath, `
      import { init } from '../../medusa-sdk/lib/src/bn254.js';
      import { Medusa } from '../../medusa-sdk/lib/src/index.js';
      import { HGamalSuite, Label } from '../../medusa-sdk/lib/src/encrypt.js';
      import fs from 'fs';
      
      async function encryptMessage() {
        try {
          // Initialize the curve
          const curve = await init();
          console.log('Initialized curve');
          
          // Create a Medusa instance
          const medusa = Medusa.init();
          console.log('Created Medusa instance');
          
          // Create an encryption suite
          const suite = new HGamalSuite(curve);
          console.log('Created encryption suite');
          
          // Create a test message to encrypt
          const msgStr = "This is a secret message that will be encrypted and decrypted through Medusa";
          const msgBuff = new TextEncoder().encode(msgStr);
          console.log('Original message:', msgStr);
          
          // Create a label for encryption
          const oraclePublicKey = {
            x: "${oraclePublicKey[0].toString()}",
            y: "${oraclePublicKey[1].toString()}"
          };
          
          // Convert the oracle public key to the format expected by the SDK
          const medusaPubkey = curve.g1.fromEvm(oraclePublicKey);
          
          // Create a label for encryption
          const label = Label.from(
            medusaPubkey,
            "${ONLYFILES_ADDRESS}",
            "${wallet.address}"
          );
          console.log('Created label for encryption');
          
          // Encrypt the message
          console.log('Encrypting message...');
          const encryptionResult = await suite.encryptToMedusa(msgBuff, medusaPubkey, label);
          
          if (encryptionResult.isErr()) {
            console.error('Failed to encrypt message:', encryptionResult.error);
            return;
          }
          
          const ciphertext = encryptionResult._unsafeUnwrap();
          console.log('Message encrypted successfully');
          
          // Convert to contract format
          const cipherEVM = ciphertext.encryptedKey.toEvm();
          const contractCipherEVM = {
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
          };
          
          // Save the encrypted data and ciphertext for later use
          const encryptedData = {
            encryptedData: Array.from(ciphertext.encryptedData),
            encryptedKey: contractCipherEVM
          };
          
          fs.writeFileSync('encrypted-data.json', JSON.stringify(encryptedData, null, 2));
          console.log('Encrypted data saved to encrypted-data.json');
          
          // Also save the contract cipher format
          fs.writeFileSync('contract-cipher.json', JSON.stringify({
            random: {
              x: BigInt(contractCipherEVM.random.x).toString(),
              y: BigInt(contractCipherEVM.random.y).toString()
            },
            cipher: BigInt(contractCipherEVM.cipher).toString(),
            random2: {
              x: BigInt(contractCipherEVM.random2.x).toString(),
              y: BigInt(contractCipherEVM.random2.y).toString()
            },
            dleq: {
              f: BigInt(contractCipherEVM.dleq.f).toString(),
              e: BigInt(contractCipherEVM.dleq.e).toString()
            }
          }, null, 2));
          console.log('Contract cipher format saved to contract-cipher.json');
        } catch (error) {
          console.error('Error during encryption:', error);
        }
      }
      
      encryptMessage().catch(console.error);
    `);
    
    // Run the temporary script with Node.js in ESM mode
    console.log("Encrypting message...");
    execSync(`cd ${__dirname} && node --experimental-modules --es-module-specifier-resolution=node temp-encrypt.js`, { stdio: 'inherit' });
    
    // Load the generated contract cipher
    const contractCipherEVM = JSON.parse(fs.readFileSync(path.join(__dirname, 'contract-cipher.json'), 'utf8'));
    console.log("Contract cipher loaded");
    
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
    
    // Update the encrypted data with the cipherId
    const encryptedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'encrypted-data.json'), 'utf8'));
    encryptedData.cipherId = cipherId.toString();
    
    // Save the updated encrypted data
    fs.writeFileSync(
      path.join(__dirname, `encrypted-data-${cipherId}.json`),
      JSON.stringify(encryptedData, null, 2)
    );
    console.log(`Encrypted data saved to encrypted-data-${cipherId}.json`);
    
    // Clean up temporary files
    fs.unlinkSync(tempScriptPath);
    fs.unlinkSync(path.join(__dirname, 'encrypted-data.json'));
    fs.unlinkSync(path.join(__dirname, 'contract-cipher.json'));
    
    console.log("\nTest listing created successfully!");
    console.log(`To test buying and decrypting this listing, run:`);
    console.log(`node test-decrypt-flow.js ${cipherId} encrypted-data-${cipherId}.json`);
    
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