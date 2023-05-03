import { FC, useEffect } from 'react'
import Head from 'next/head'

import { APP_NAME } from '@/lib/consts'
import ListingForm from '@/components/ListingForm'
import Listings from '@/components/Listings'
import PurchasedSecrets from '@/components/PurchasedSecrets'
import Header from '@/components/Header'
import { Toaster } from 'react-hot-toast'
import EventsFetcher from '@/components/EventsFetcher'
import useIsMounted from '@/hooks/useIsMounted'
import { useAccount, useNetwork, useSigner } from 'wagmi'
import useSyncChain from '@/hooks/useSyncChain'

const Home: FC = () => {
  const isMounted = useIsMounted()
  const { chain } = useNetwork()
  const { isConnected, address, connector } = useAccount()
  const { signer, isError } = useSigner({ chainId: chain?.id })
  useSyncChain()

  console.log(isConnected, address, connector)

  if (!isMounted) return null

  return (
    <>
      <EventsFetcher />
      <Head>
        <title>{`Medusa - ${APP_NAME}`}</title>
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      </Head>

      <Toaster position="top-center" reverseOrder={true} />
      <div className="min-h-screen">
        <Header />

        <div className="relative flex items-top justify-center sm:items-center py-4 sm:pt-0">
          <div className="max-w-6xl mx-auto px-6 lg:px-8">
            <div className="flex pt-0 justify-center sm:hidden">
              <h1 className="text-5xl font-light dark:text-white">
                {APP_NAME}
              </h1>
            </div>

            <div className="flex justify-center sm:pt-0 my-7">
              <p className="text-xl font-bold text-orange-500 ml-2">
                Buy and Sell Private Files!
              </p>
            </div>

            <ListingForm />

            <PurchasedSecrets />

            <Listings />
          </div>
        </div>
      </div>
    </>
  )
}

export default Home
