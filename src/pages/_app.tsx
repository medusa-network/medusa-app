import 'tailwindcss/tailwind.css'
import '@/styles/globals.css'
import { ThemeProvider } from 'next-themes'
import PlausibleProvider from 'next-plausible'

import Web3Provider from '@/components/Web3Provider'

const App = ({ Component, pageProps }) => {
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
