import { FC } from 'react'
import Link from 'next/link'
import { useNetwork } from 'wagmi'
import ConnectWallet from './ConnectWallet'
import toast from 'react-hot-toast'
import { arbitrumSepolia } from '@/lib/consts'
import { APP_NAME } from '@/lib/consts'

// Create a type for the ethereum provider
type EthereumProvider = {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
};

const Header: FC = () => {
  const { chain } = useNetwork()

  const handleFaucet = async (event: any) => {
    event.preventDefault()
    if (!chain) return

    switch (chain.id) {
      case arbitrumSepolia.id: {
        handleArbitrumFaucet()
        break
      }
      default: {
        toast.error('No faucet available for this network')
      }
    }
  }

  const handleArbitrumFaucet = async () => {
    try {
      // Use type assertion for ethereum
      const ethereum = window.ethereum as EthereumProvider | undefined
      const accounts = await ethereum?.request({
        method: 'eth_requestAccounts',
      })
      const address = accounts?.[0]
      if (!address) {
        toast.error('Please connect your wallet first')
        return
      }

      const response = await fetch(`/api/faucet?address=${address}`)
      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
      } else {
        toast.success(
          <div>
            Tokens sent! View on{' '}
            <a
              href={`https://sepolia.arbiscan.io/tx/${data.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Arbiscan
            </a>
          </div>,
        )
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to send tokens')
    }
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-800">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-xl font-bold">
          {APP_NAME}
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={handleFaucet}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          Get Test Tokens
        </button>
        <ConnectWallet />
      </div>
    </header>
  )
}

export default Header
