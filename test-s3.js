// Test script to verify S3 storage configuration
require('dotenv').config();
const fs = require('fs');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

// Read credentials from the creds.s3 file
let s3Endpoint = '';
let s3AccessKeyId = '';
let s3SecretAccessKey = '';

try {
  const credsPath = process.env.S3_CREDENTIALS_PATH || './creds.s3';
  const credsContent = fs.readFileSync(credsPath, 'utf8');
  
  // Split by lines and extract credentials
  const lines = credsContent.split('\n').map(line => line.trim()).filter(line => line);
  
  if (lines.length >= 1) s3Endpoint = lines[0];
  if (lines.length >= 2) s3AccessKeyId = lines[1];
  if (lines.length >= 3) s3SecretAccessKey = lines[2];
  
  console.log('Credentials loaded successfully');
} catch (error) {
  console.error('Error loading credentials:', error);
  process.exit(1);
}

// Create S3 client
const s3Client = new S3Client({
  region: 'auto',
  endpoint: s3Endpoint,
  credentials: {
    accessKeyId: s3AccessKeyId,
    secretAccessKey: s3SecretAccessKey,
  },
  forcePathStyle: true,
});

// Use the existing bucket
const bucketName = 'ru-medusa-demo';
const testKey = `test-${Date.now()}.txt`;
const testContent = 'This is a test file to verify storage configuration.';

async function runTest() {
  console.log('Starting storage test...');
  console.log(`Storage Endpoint: ${s3Endpoint}`);
  console.log(`Bucket: ${bucketName}`);
  
  try {
    // Upload test file
    console.log(`Uploading test file with key: ${testKey}`);
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
    });
    
    await s3Client.send(putCommand);
    console.log('Test file uploaded successfully');
    
    // Construct the URL
    const publicUrl = `${s3Endpoint}/${bucketName}/${testKey}`;
    console.log(`File should be accessible at: ${publicUrl}`);
    
    // Try to download the file to verify
    console.log('Attempting to download the file to verify...');
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: testKey,
    });
    
    const response = await s3Client.send(getCommand);
    const responseBody = await streamToString(response.Body);
    
    if (responseBody === testContent) {
      console.log('✅ SUCCESS: File content matches what was uploaded');
    } else {
      console.log('❌ ERROR: File content does not match what was uploaded');
      console.log(`Expected: ${testContent}`);
      console.log(`Received: ${responseBody}`);
    }
    
    console.log('Storage test completed successfully');
  } catch (error) {
    console.error('Error during storage test:', error);
  }
}

// Helper function to convert stream to string
async function streamToString(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

runTest();