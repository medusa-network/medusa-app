const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log("=== MEDUSA ONLYFILES FULL FLOW TEST ===");
console.log("This script will:");
console.log("1. Create a test listing with encrypted data");
console.log("2. Buy the listing");
console.log("3. Decrypt the content");
console.log("=======================================\n");

// Store the current directory
const currentDir = __dirname;

async function runFullFlow() {
  try {
    // Step 1: Create a test listing
    console.log("\n=== STEP 1: CREATING TEST LISTING ===\n");
    const createListingOutput = execSync(`node ${path.join(currentDir, 'create-test-listing.js')}`, { 
      stdio: ['inherit', 'pipe', 'inherit'] 
    }).toString();
    
    // Extract the cipherId and encrypted data file path from the output
    const cipherIdMatch = createListingOutput.match(/Listing created with cipherId: (\d+)/);
    if (!cipherIdMatch) {
      throw new Error("Could not extract cipherId from create-test-listing.js output");
    }
    
    const cipherId = cipherIdMatch[1];
    const encryptedDataPath = path.join(currentDir, `encrypted-data-${cipherId}.json`);
    
    // Verify the encrypted data file exists
    if (!fs.existsSync(encryptedDataPath)) {
      throw new Error(`Encrypted data file not found at ${encryptedDataPath}`);
    }
    
    console.log(`\nSuccessfully created listing with cipherId: ${cipherId}`);
    console.log(`Encrypted data saved to: ${encryptedDataPath}`);
    
    // Step 2 & 3: Buy the listing and decrypt the content
    console.log("\n=== STEP 2 & 3: BUYING LISTING AND DECRYPTING CONTENT ===\n");
    
    // Wait a bit to ensure the listing is available on the blockchain
    console.log("Waiting 5 seconds for the listing to be available...");
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    execSync(`node ${path.join(currentDir, 'test-decrypt-flow.js')} ${cipherId} ${encryptedDataPath}`, { 
      stdio: 'inherit' 
    });
    
    // Check if the decrypted file exists
    const decryptedFilePath = path.join(currentDir, `decrypted-message-${cipherId}.txt`);
    if (fs.existsSync(decryptedFilePath)) {
      console.log("\n=== DECRYPTION RESULT ===");
      const decryptedContent = fs.readFileSync(decryptedFilePath, 'utf8');
      console.log("Decrypted content:");
      console.log(decryptedContent);
      console.log("\n=== TEST COMPLETED SUCCESSFULLY ===");
    } else {
      console.log("\n=== DECRYPTION FILE NOT FOUND ===");
      console.log("The decryption process may have failed or the file was not saved correctly.");
    }
    
  } catch (error) {
    console.error("\n=== ERROR DURING TEST ===");
    console.error(error);
    process.exit(1);
  }
}

// Run the full flow
runFullFlow().catch(console.error); 