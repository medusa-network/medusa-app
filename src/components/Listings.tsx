import { FC } from 'react'

import useGlobalStore from '@/stores/globalStore'
import Listing from './Listing'
import { useAccount } from 'wagmi'

const Listings: FC = () => {
  const { address, isConnected } = useAccount()
  const sales = useGlobalStore((state) => state.sales)
  const allListings = useGlobalStore((state) => state.listings)
  const listings = allListings.map((listing) => {
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
        listings.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-4 w-full transition-all">
            {listings.map((listing) => (
              <Listing key={listing.cipherId.toNumber()} {...listing} />
            ))}
          </div>
        ) : (
          <div className="bg-gray-800 text-white p-4 rounded-md shadow-lg mb-6">
            <p className="text-lg">No listings available yet.</p>
            <p className="text-sm mt-2">Be the first to create a listing using the form above!</p>
            <p className="text-xs mt-4 text-gray-400">
              If you just created a listing, it may take a moment to appear. Try refreshing the page.
            </p>
          </div>
        )
      ) : (
        <p className="text-base text-gray-300 ml-2">
          Connect your wallet to buy content
        </p>
      )}
    </>
  )
}

export default Listings
