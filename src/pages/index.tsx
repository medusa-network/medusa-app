import { FC, useEffect } from 'react'
import Head from 'next/head'
import { useAccount, useContract, useContractEvent, useNetwork, useProvider, useSigner } from 'wagmi'

import { APP_NAME, CHAIN_CONFIG, CONTRACT_ABI } from '@/lib/consts'
import ListingForm from '@/components/ListingForm'
import Listings from '@/components/Listings'
import { Listing, Sale, Decryption, default as useGlobalStore } from '@/stores/globalStore'
import { ethers } from 'ethers'
import PurchasedSecrets from '@/components/PurchasedSecrets'
import Header from '@/components/Header'
import { Toaster } from 'react-hot-toast'

const Home: FC = () => {
  const provider = useProvider()
  const { address } = useAccount()
  const { chain } = useNetwork()

  const updateListings = useGlobalStore((state) => state.updateListings)
  const updateSales = useGlobalStore((state) => state.updateSales)
  const updateDecryptions = useGlobalStore((state) => state.updateDecryptions)
  const addListing = useGlobalStore((state) => state.addListing)
  const addSale = useGlobalStore((state) => state.addSale)
  const addDecryption = useGlobalStore((state) => state.addDecryption)

  const chainConfig = CHAIN_CONFIG[chain?.id]

  useContractEvent({
    address: chainConfig?.appContractAddress,
    abi: CONTRACT_ABI,
    eventName: 'NewListing',
    listener(seller, cipherId, name, description, price, uri) {
      addListing({ seller, cipherId, name, description, price, uri })
    },
  })

  useContractEvent({
    address: chainConfig?.appContractAddress,
    abi: CONTRACT_ABI,
    eventName: 'NewSale',
    listener(buyer, seller, requestId, cipherId) {
      if (buyer === address) {
        addSale({ buyer, seller, requestId, cipherId })
      }
    },
  })

  useContractEvent({
    address: chainConfig?.appContractAddress,
    abi: CONTRACT_ABI,
    eventName: 'ListingDecryption',
    listener(requestId, ciphertext) {
      addDecryption({ requestId, ciphertext })
    },
  })

  const medusaFans = useContract({
    address: chainConfig?.appContractAddress,
    abi: CONTRACT_ABI,
    signerOrProvider: provider
  })

  useEffect(() => {
    const getEventsForFilter = async (filter: ethers.EventFilter): Promise<ethers.Event[]> => {
      const events = await medusaFans.queryFilter(filter)
      return events.reverse().filter(event => !event.removed)
        .filter((value, index, self) =>
          index === self.findIndex((t) => (
            t.transactionHash === value.transactionHash && t.logIndex === value.logIndex
          ))
        )
    }

    const getEvents = async () => {
      const iface = new ethers.utils.Interface(CONTRACT_ABI)

      const newListings = await getEventsForFilter(medusaFans.filters.NewListing())
      const listings = newListings.map((filterTopic: ethers.Event) => {
        const result = iface.parseLog(filterTopic)
        const { seller, cipherId, name, description, price, uri } = result.args
        return { seller, cipherId, name, description, price, uri } as Listing
      })
      updateListings(listings)

      const newSales = await getEventsForFilter(medusaFans.filters.NewSale(address))
      const sales = newSales.map((filterTopic: ethers.Event) => {
        const result = iface.parseLog(filterTopic)
        const { buyer, seller, requestId, cipherId } = result.args
        return { buyer, seller, requestId, cipherId } as Sale
      })
      updateSales(sales)

      const listingDecryptions = await getEventsForFilter(medusaFans.filters.ListingDecryption())
      const decryptions = listingDecryptions.map((filterTopic: ethers.Event) => {
        const result = iface.parseLog(filterTopic)
        const { requestId, ciphertext } = result.args
        return { requestId, ciphertext } as Decryption
      })
      updateDecryptions(decryptions)
    }
    if (medusaFans) {
      getEvents()
    }
  }, [chain?.id, address])

  return (
    <>
      <Head>
        <title>{`Medusa - ${APP_NAME}`}</title>
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      </Head>

      <Toaster
        position="top-center"
        reverseOrder={true}
      />

      <Header />

      <div className="relative flex items-top justify-center min-h-screen bg-gray-100 dark:bg-gray-800 sm:items-center py-4 sm:pt-0">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex pt-8 justify-center sm:pt-0 my-7">
            <h1 className="text-6xl font-mono font-light dark:text-white">{APP_NAME}</h1>

          </div>
          <div className="flex justify-center sm:pt-0 my-7">
            <p className="text-lg font-mono font-light dark:text-white ml-2">Encrypt & upload your content and set your price for people to see it!</p>
          </div>

          <ListingForm />

          <PurchasedSecrets />

          <Listings />

        </div>
      </div>
    </>
  )
}

export default Home
