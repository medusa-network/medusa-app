import { useSwitchNetwork } from 'wagmi';
import { getProvider } from '@wagmi/core';
import { VoidSigner } from 'ethers';
import { Medusa } from '@medusa-network/medusa-sdk';

import useGlobalStore from '@/stores/globalStore'
import { CHAIN_CONFIG } from '@/lib/consts';
import { useCallback } from 'react';

export default function useSwitchChain() {
  const { switchNetworkAsync } = useSwitchNetwork()

  const medusa = useGlobalStore((state) => state.medusa)
  const updateMedusa = useGlobalStore((state) => state.updateMedusa)
  const updateListings = useGlobalStore((state) => state.updateListings)
  const updateSales = useGlobalStore((state) => state.updateSales)
  const updateDecryptions = useGlobalStore((state) => state.updateDecryptions)

  return useCallback(
    async (chainId: number) => {
      await switchNetworkAsync?.(chainId)

      updateListings([])
      updateSales([])
      updateDecryptions([])

      if (medusa) {
        const newMedusa = await Medusa.init(
          CHAIN_CONFIG[chainId].oracleContractAddress,
          new VoidSigner(await medusa.signer.getAddress(), getProvider({ chainId }))
        )
        newMedusa.setKeypair(medusa.keypair)
        updateMedusa(newMedusa)
      }
    }, [switchNetworkAsync]
  )
}

