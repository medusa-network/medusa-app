import { FC, useEffect } from 'react'
import Head from 'next/head'

import { APP_NAME } from '@/lib/consts'
import Header from '@/components/Header'
import { Toaster } from 'react-hot-toast'
import EventsFetcher from '@/components/EventsFetcher'
import useIsMounted from '@/hooks/useIsMounted'
import { useAccount, useNetwork, useSigner } from 'wagmi'
import useSyncChain from '@/hooks/useSyncChain'
import UnlockPrompt from '@/components/UnlockPrompt'
import Footer from '@/components/Footer'

const Home: FC = () => {
  const isMounted = useIsMounted()
  const { chain } = useNetwork()
  const { isConnected, address, connector } = useAccount()
  const { signer, isError } = useSigner({ chainId: chain?.id })
  useSyncChain()

  console.log(isConnected, address, connector)

  if (!isMounted) return null

  // <EventsFetcher /
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

      <div className="min-h-screen">
        <Header />

        <div className="relative flex items-top justify-center sm:items-center py-4 sm:pt-0">

          <div className="max-w-6xl mx-auto px-6 lg:px-8 flex flex-col justify-between space-y-10">
            <div className="flex pt-0 justify-center sm:hidden">
              <h1 className="text-5xl font-light dark:text-white">{APP_NAME}</h1>
            </div>
            <div className="flex text-center text-dark-secondary font-semibold justify-center sm:text-xl my-7 sm:my-4">
              <p className="ml-2">🤖 Contribute AI prompts</p>
              <p className="ml-2">💰 <span className="text-green-500">Earn credits</span></p>
              <p className="ml-2">📜 Unlock more prompts!</p>
            </div>
            <UnlockPrompt description="Plug this prompt into GPT4 to learn about OnlyPrompts and the Medusa network" />
            <UnlockPrompt description="Generate website illustrations with GPT 4 (ASCII) - GPT can output tables, but did you know it can also illustrate website layouts? This can be used" />
            <Footer />
          </div>

        </div>
      </div>
    </>
  )
}

export default Home
