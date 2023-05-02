import { useEffect } from 'react'
import { useAccount, useNetwork } from 'wagmi'
import useChains from './useChains'
import useSwitchChain from './useSwitchChain'

export default function useSyncChain() {
  const { isConnected } = useAccount()
  const { chain } = useNetwork()
  const switchChain = useSwitchChain()
  const { defaultChain } = useChains()

  useEffect(() => {
    if (!isConnected) return

    if (chain !== defaultChain) {
      switchChain?.(defaultChain.id)
    }
  }, [isConnected, defaultChain.id, switchChain])
}
