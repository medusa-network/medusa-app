import { Storage } from '@google-cloud/storage';
import path from 'path';

// Create a Google Cloud Storage client using a credentials file
// The credentials file should be a JSON file containing all the necessary credentials
// including project_id, private_key, private_key_id, client_email, client_id, etc.
export const storage = new Storage({
  keyFilename: process.env.GCS_CREDENTIALS_PATH,
});

export const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'medusa-ciphertexts'; 