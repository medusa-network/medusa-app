export function getStorageLink(key: string): string {
  // If the key is empty or invalid, return empty string
  if (!key || typeof key !== 'string') {
    return '';
  }
  
  // Use the S3 public URL from environment variable or fallback to a default
  const endpoint = process.env.NEXT_PUBLIC_S3_PUBLIC_URL || 'https://storage.googleapis.com';
  const bucketName = process.env.NEXT_PUBLIC_S3_BUCKET_NAME || 'ru-medusa-demo';
  
  // If the key is already a full URL, return it as is
  if (key.startsWith('http://') || key.startsWith('https://')) {
    return key;
  }
  
  // Otherwise, construct the S3 URL
  return `${endpoint}/${bucketName}/${key}`;
}

// Keep the old function for backward compatibility, but make it use S3
export function ipfsGatewayLink(cidOrUri: string): string {
  // If it's an IPFS URI, return empty string
  if (cidOrUri && cidOrUri.startsWith('ipfs://')) {
    console.warn('IPFS URI detected, ignoring:', cidOrUri);
    return '';
  }
  
  return getStorageLink(cidOrUri);
}
