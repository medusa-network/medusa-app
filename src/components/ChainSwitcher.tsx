import { CHAIN_CONFIG, wallaby } from '@/lib/consts'
import useGlobalStore from '@/stores/globalStore'
import { JsonRpcSigner } from '@ethersproject/providers'
import { Medusa } from '@medusa-network/medusa-sdk'
import { getProvider } from '@wagmi/core'
import { VoidSigner } from 'ethers'
import { useNetwork, useSwitchNetwork } from 'wagmi'
import { arbitrumGoerli } from 'wagmi/chains'

const ChainSwitcher = ({ className = '' }) => {
  const { chain } = useNetwork()
  const { error, isLoading, pendingChainId, switchNetworkAsync } =
    useSwitchNetwork()
  const chains = [arbitrumGoerli, wallaby]

  const medusa = useGlobalStore((state) => state.medusa)
  const updateMedusa = useGlobalStore((state) => state.updateMedusa)
  const updateListings = useGlobalStore((state) => state.updateListings)
  const updateSales = useGlobalStore((state) => state.updateSales)
  const updateDecryptions = useGlobalStore((state) => state.updateDecryptions)

  const handleSwitch = async (chainId: number) => {
    await switchNetworkAsync?.(chainId)

    updateListings([])
    updateSales([])
    updateDecryptions([])

    if (medusa) {
      const newMedusa = await Medusa.init(
        CHAIN_CONFIG[chainId].oracleContractAddress,
        new VoidSigner(await medusa.signer.getAddress(), getProvider({ chainId }))
        // null
        // medusa.signer.provider connect(getProvider({ chainId }))
      )
      newMedusa.setKeypair(medusa.keypair)
      updateMedusa(newMedusa)
    }
  }

  return (
    <>
      {chain && <div>Connected to {chain.name}</div>}
      {chains.map((x) => (
        <button
          disabled={!switchNetworkAsync || x.id === chain?.id}
          key={x.id}
          onClick={() => handleSwitch(x.id)}
        >
          {x.name}
          {isLoading && pendingChainId === x.id && ' (switching)'}
        </button>
      ))}

      <div>{error && error.message}</div>
    </>
  )
}

// return (
//   <button
//     onClick={() => updateChain(wallaby)}
//     className={`${className} rounded-full p-1 border-2 border-gray-300 dark:border-gray-800 text-gray-500 dark:text-gray-400`}
//   >
//     Switch to Wallaby
//   </button>
// )

export default ChainSwitcher
