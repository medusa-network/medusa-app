// Stores a ciphertext by submitting it to the endpoint in @/api/storeCiphertext.ts
// Returns the file key from S3 storage
export default async function storeCiphertext(
  name: string,
  ciphertext: string,
): Promise<string> {
  const endpoint = '/api/storeCiphertext'

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      ciphertext,
    }),
  }

  const response = await fetch(endpoint, options)

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to store ciphertext');
  }

  const { key } = await response.json()
  return key // Return the S3 key directly
}
