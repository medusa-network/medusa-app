import { useRouter } from 'next/router'
import { arbitrumGoerli, mainnet } from 'wagmi/chains'

import { hyperspace } from '@/lib/consts'

const SUPPORTED_CHAINS = [arbitrumGoerli, hyperspace, mainnet]

export default function useChains() {
  const router = useRouter()
  let { chain } = router.query
  if (!chain)
    return {
      defaultChain: SUPPORTED_CHAINS[0],
      supportedChains: SUPPORTED_CHAINS,
    }

  if (!(typeof chain === 'string')) {
    chain = chain[0]
  }

  const defaultChain = SUPPORTED_CHAINS.find((c) => c.network === chain)
  if (defaultChain) {
    return {
      defaultChain,
      supportedChains: [
        defaultChain,
        ...SUPPORTED_CHAINS.filter((c) => c !== defaultChain),
      ],
    }
  }

  return {
    defaultChain: SUPPORTED_CHAINS[0],
    supportedChains: SUPPORTED_CHAINS,
  }
}
