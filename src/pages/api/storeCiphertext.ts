import { NextApiRequest, NextApiResponse } from 'next'
import { s3Client, S3_BUCKET_NAME } from '@/lib/s3'
import { PutObjectCommand } from '@aws-sdk/client-s3'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { name, ciphertext } = req.body
  console.log('name', name)
  
  try {
    // Generate a unique key for the file
    const key = `${Date.now()}_${name}`
    
    // Create a PutObjectCommand to upload the ciphertext to S3
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
      Body: ciphertext,
      ContentType: 'text/plain',
    })
    
    // Upload the ciphertext to S3
    await s3Client.send(command)
    
    // Construct the URL (this will depend on your S3 configuration)
    const endpoint = process.env.S3_PUBLIC_URL || 'https://storage.googleapis.com'
    const publicUrl = `${endpoint}/${S3_BUCKET_NAME}/${key}`
    
    console.log(`File uploaded: ${publicUrl}`)
    
    // Return the key as the identifier (similar to CID in IPFS)
    res.status(200).json({ cid: key })
  } catch (error) {
    console.error('Error in storage handler:', error)
    res.status(500).json({ error: 'Failed to store ciphertext' })
  }
}

export default handler
