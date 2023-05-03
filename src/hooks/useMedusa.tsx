import useGlobalStore from '@/stores/globalStore'
import { SecretKey, PublicKey, Medusa } from '@medusa-network/medusa-sdk'
import { CHAIN_CONFIG } from '@/lib/consts'
import { useNetwork, useSigner } from 'wagmi'

export default function useMedusa() {
  const { chain } = useNetwork()
  const medusa = useGlobalStore((state) => state.medusa)
  const updateMedusa = useGlobalStore((state) => state.updateMedusa)
  const { data: signer } = useSigner()

  const signed = medusa?.keypair

  const signMessage = async (): Promise<
    Medusa<SecretKey, PublicKey<SecretKey>>
  > => {
    if (!signer) return
    const medusa = await Medusa.init(
      CHAIN_CONFIG[chain?.id]?.oracleContractAddress,
      signer,
    )
    await medusa.signForKeypair()
    updateMedusa(medusa)
    return medusa
  }

  return {
    medusa,
    signed,
    signMessage,
  }
}
