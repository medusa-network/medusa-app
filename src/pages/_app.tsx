import 'tailwindcss/tailwind.css'
import '@/styles/globals.css'
import { ThemeProvider } from 'next-themes'
import PlausibleProvider from 'next-plausible'
import { useEffect } from 'react'
import useGlobalStore from '@/stores/globalStore'
import type { AppProps } from 'next/app'

import Web3Provider from '@/components/Web3Provider'

const App = ({ Component, pageProps }: AppProps) => {
  const clearSessionDecryptions = useGlobalStore((state) => state.clearSessionDecryptions)
  
  // Clear session decryptions when the app loads
  useEffect(() => {
    clearSessionDecryptions()
  }, [clearSessionDecryptions])
  
  return (
    <PlausibleProvider domain="demo.medusanet.xyz">
      <ThemeProvider attribute="class">
        <Web3Provider>
          <Component {...pageProps} />
        </Web3Provider>
      </ThemeProvider>
    </PlausibleProvider>
  )
}

export default App
