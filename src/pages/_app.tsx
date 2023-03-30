import 'tailwindcss/tailwind.css'
import '@/styles/globals.css'
import { ThemeProvider } from 'next-themes'

import Web3Provider from '@/components/Web3Provider'
import Head from 'next/head'

const App = ({ Component, pageProps }) => {
  return (
    <ThemeProvider attribute="class">
      <Web3Provider>
        <Component {...pageProps} />
      </Web3Provider>
    </ThemeProvider>
  )
}

export default App
