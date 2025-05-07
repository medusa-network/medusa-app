import { getNetwork } from '@wagmi/core'
import { ethers } from 'ethers'
import type { NextApiRequest, NextApiResponse } from 'next'
import { arbitrumSepolia } from '@/lib/consts'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { address } = req.query

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Invalid address' })
  }

  if (!process.env.FAUCET_PRIVATE_KEY) {
    return res.status(500).json({ error: 'Faucet not configured' })
  }

  try {
    const provider = new ethers.providers.JsonRpcProvider(
      arbitrumSepolia.rpcUrls.default.http[0],
    )
    const wallet = new ethers.Wallet(process.env.FAUCET_PRIVATE_KEY, provider)

    const tx = await wallet.sendTransaction({
      to: address,
      value: ethers.utils.parseEther('0.05'),
    })

    return res.status(200).json({ txHash: tx.hash })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Failed to send transaction' })
  }
}
