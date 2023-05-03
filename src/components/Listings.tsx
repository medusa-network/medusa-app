import { FC } from 'react'

import useGlobalStore from '@/stores/globalStore'
import Listing from './Listing'
import { useAccount } from 'wagmi'

const Listings: FC = () => {
  const { address, isConnected } = useAccount()
  const sales = useGlobalStore((state) => state.sales)
  const listings = useGlobalStore((state) => state.listings).map((listing) => {
    return {
      ...listing,
      purchased: sales.some(
        (sale) => sale.buyer === address && sale.cipherId.eq(listing.cipherId),
      ),
    }
  })

  return (
    <>
      <h1 className="text-2xl mt-10 mb-6">Buy Content</h1>
      {isConnected ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-4 w-full transition-all">
          {listings.map((listing) => (
            <Listing key={listing.cipherId.toNumber()} {...listing} />
          ))}
        </div>
      ) : (
        <p className="text-base text-gray-300 ml-2">
          Connect your wallet to buy content
        </p>
      )}
    </>
  )
}

export default Listings
