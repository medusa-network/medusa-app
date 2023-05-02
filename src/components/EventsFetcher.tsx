import { FC, useEffect } from 'react'
import {
  useAccount,
  useContract,
  useContractEvent,
  useNetwork,
  useProvider,
} from 'wagmi'

import { CHAIN_CONFIG, CONTRACT_ABI } from '@/lib/consts'
import {
  Listing,
  Sale,
  Decryption,
  default as useGlobalStore,
} from '@/stores/globalStore'
import { BigNumber, ethers } from 'ethers'
import { HGamalEVMCipher as Ciphertext } from '@medusa-network/medusa-sdk'

const EventsFetcher: FC = () => {
  const provider = useProvider()
  const { address } = useAccount()
  const { chain } = useNetwork()

  const updateListings = useGlobalStore((state) => state.updateListings)
  const updateSales = useGlobalStore((state) => state.updateSales)
  const updateDecryptions = useGlobalStore((state) => state.updateDecryptions)

  const addListing = useGlobalStore((state) => state.addListing)
  const addSale = useGlobalStore((state) => state.addSale)
  const addDecryption = useGlobalStore((state) => state.addDecryption)

  const listings = useGlobalStore((state) => state.listings)
  const sales = useGlobalStore((state) => state.sales)
  const decryptions = useGlobalStore((state) => state.decryptions)

  const chainConfig = CHAIN_CONFIG[chain?.id]

  useContractEvent({
    address: chainConfig?.appContractAddress,
    abi: CONTRACT_ABI,
    eventName: 'NewListing',
    listener(
      seller: string,
      cipherId: BigNumber,
      name: string,
      description: string,
      price: BigNumber,
      uri: string,
    ) {
      addListing({ seller, cipherId, name, description, price, uri })
    },
  })

  useContractEvent({
    address: chainConfig?.appContractAddress,
    abi: CONTRACT_ABI,
    eventName: 'NewSale',
    listener(
      buyer: string,
      seller: string,
      requestId: BigNumber,
      cipherId: BigNumber,
    ) {
      if (buyer === address) {
        addSale({ buyer, seller, requestId, cipherId })
      }
    },
  })

  useContractEvent({
    address: chainConfig?.appContractAddress,
    abi: CONTRACT_ABI,
    eventName: 'ListingDecryption',
    listener(requestId: BigNumber, ciphertext: Ciphertext) {
      addDecryption({ requestId, ciphertext })
    },
  })

  const medusaFans = useContract({
    address: chainConfig?.appContractAddress,
    abi: CONTRACT_ABI,
    signerOrProvider: provider,
  })

  useEffect(() => {
    const getEventsForFilter = async (
      filter: ethers.EventFilter,
    ): Promise<ethers.Event[]> => {
      const events = await medusaFans.queryFilter(filter)
      return events
        .reverse()
        .filter((event) => !event.removed)
        .filter(
          (value, index, self) =>
            index ===
            self.findIndex(
              (t) =>
                t.transactionHash === value.transactionHash &&
                t.logIndex === value.logIndex,
            ),
        )
    }

    const getEvents = async () => {
      const iface = new ethers.utils.Interface(CONTRACT_ABI)

      const newListings = await getEventsForFilter(
        medusaFans.filters.NewListing(),
      )
      const listings = newListings.map((filterTopic: ethers.Event) => {
        const result = iface.parseLog(filterTopic)
        const { seller, cipherId, name, description, price, uri } = result.args
        return { seller, cipherId, name, description, price, uri } as Listing
      })
      updateListings(listings)

      const newSales = await getEventsForFilter(
        medusaFans.filters.NewSale(address),
      )
      const sales = newSales.map((filterTopic: ethers.Event) => {
        const result = iface.parseLog(filterTopic)
        const { buyer, seller, requestId, cipherId } = result.args
        return { buyer, seller, requestId, cipherId } as Sale
      })
      updateSales(sales)

      const listingDecryptions = await getEventsForFilter(
        medusaFans.filters.ListingDecryption(),
      )
      const decryptions = listingDecryptions.map(
        (filterTopic: ethers.Event) => {
          const result = iface.parseLog(filterTopic)
          const { requestId, ciphertext } = result.args
          return { requestId, ciphertext } as Decryption
        },
      )
      updateDecryptions(decryptions)
    }
    if (medusaFans) {
      getEvents()
    }
  }, [chain?.id, address])

  return <> </>
}

export default EventsFetcher
