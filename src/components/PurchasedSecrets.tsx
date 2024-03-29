import { FC } from 'react'
import { useAccount } from 'wagmi'

import useGlobalStore from '@/stores/globalStore'
import Unlocked from './Unlocked'

const PurchasedSecrets: FC = () => {
  const { address } = useAccount()
  const sales = useGlobalStore((state) => state.sales)

  const myPurchasedSecrets = sales.filter((sale) => sale.buyer == address)

  return (
    <>
      <h1 className="text-2xl mt-10 mb-6">Unlocked Content</h1>
      {myPurchasedSecrets.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4 w-full transition-all">
          {myPurchasedSecrets.map((sale) => (
            <Unlocked key={sale.requestId.toNumber()} {...sale} />
          ))}
        </div>
      ) : (
        <p className="text-base text-gray-300 ml-2">
          You have not unlocked any content yet. Sign in and purchase some
          content to see it decrypted!
        </p>
      )}
    </>
  )
}

export default PurchasedSecrets
