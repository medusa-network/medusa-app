import { S3Client } from '@aws-sdk/client-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';

// Read credentials from the creds.s3 file
let s3Endpoint = '';
let s3AccessKeyId = '';
let s3SecretAccessKey = '';

try {
  // Read credentials from the creds.s3 file
  const credsPath = process.env.S3_CREDENTIALS_PATH || './creds.s3';
  const credsContent = fs.readFileSync(credsPath, 'utf8');
  
  // Split by lines and extract credentials
  const lines = credsContent.split('\n').map(line => line.trim()).filter(line => line);
  
  if (lines.length >= 1) s3Endpoint = lines[0];
  if (lines.length >= 2) s3AccessKeyId = lines[1];
  if (lines.length >= 3) s3SecretAccessKey = lines[2];
  
  console.log('S3 credentials loaded successfully');
} catch (error) {
  console.error('Error loading S3 credentials:', error);
}

// Create S3 client
export const s3Client = new S3Client({
  region: 'auto',
  endpoint: s3Endpoint || process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: s3AccessKeyId || process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: s3SecretAccessKey || process.env.S3_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true,
});

// Use the existing bucket
export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'ru-medusa-demo'; 