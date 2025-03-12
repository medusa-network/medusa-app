
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
            x: "14021819210000811274017671674610249969463539133252327488344629645973541604082",
            y: "14933454998568661798412913489742642739900363621376773457608601550459042194954"
          };
          
          // Convert the oracle public key to the format expected by the SDK
          const medusaPubkey = curve.g1.fromEvm(oraclePublicKey);
          
          // Create a label for encryption
          const label = Label.from(
            medusaPubkey,
            "0x5567aca23bE9a5899010a4D3fA83b9da2B947256",
            "0xF31dD0a8115EaF5cbD51a3C2b879a7Cc819c92BF"
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
    