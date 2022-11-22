import { FC } from 'react'
import useGlobalStore from '@/stores/globalStore'
import { Medusa } from '@medusa-network/medusa-sdk'
import { ORACLE_ADDRESS } from '@/lib/consts'
import { useSigner } from 'wagmi'
import shallow from 'zustand/shallow'


const Signin: FC = () => {
  const medusa = useGlobalStore((state) => state.medusa)
  const updateMedusa = useGlobalStore((state) => state.updateMedusa)
  const { data: signer } = useSigner()
  console.log(medusa)

  const signMessage = async () => {
    if (!signer) return
    const medusa = await Medusa.init(ORACLE_ADDRESS, signer)
    await medusa.signForKeypair()
    updateMedusa(medusa)
  }

  console.log(medusa?.keypair)
  if (medusa?.keypair) {
    return <button
      className="bg-gray-700 hover:bg-gray-500 hover:cursor-pointer text-gray-50 py-2 px-4 rounded"
      onClick={() => medusa.setKeypair(null)}
    >
      Sign out
    </button>
  }

  return <button
    className="bg-gray-700 hover:bg-gray-500 hover:cursor-pointer text-gray-50 py-2 px-4 rounded"
    onClick={() => signMessage()}
  >
    Sign in
  </button>
}

export default Signin;
