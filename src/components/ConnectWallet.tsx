import { FC } from 'react'
import { useAccount, useConnect, useDisconnect, useNetwork } from 'wagmi'

type Visibility = 'always' | 'connected' | 'not_connected'

const ConnectWallet: FC<{ show?: Visibility }> = ({ show = 'always' }) => {
  const { isConnected, address } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { chain } = useNetwork()
  
  const isHoleskyNetwork = chain?.id === 17000
  
  if (
    (show === 'connected' && !isConnected) ||
    (show === 'not_connected' && isConnected)
  )
    return null

  if (isConnected) {
    // If connected but not to Holesky, show a warning button
    if (!isHoleskyNetwork) {
      return (
        <button
          onClick={() => disconnect()}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
        >
          Wrong Network - Switch to Holesky
        </button>
      )
    }
    
    return (
      <button
        onClick={() => disconnect()}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Disconnect'}
      </button>
    )
  }

  return (
    <button
      onClick={() => connect({ connector: connectors[0] })}
      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      Connect to Holesky
    </button>
  )
}

export default ConnectWallet
