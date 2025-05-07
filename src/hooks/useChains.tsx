import { mainnet } from 'wagmi/chains'
import { holesky } from '@/lib/consts'

const SUPPORTED_CHAINS = [holesky]

const useChains = () => {
  return {
    defaultChain: holesky,
    supportedChains: SUPPORTED_CHAINS,
  }
}

export default useChains
