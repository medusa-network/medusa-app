import { useTheme } from 'next-themes'
import { APP_NAME, hyperspace, wallaby } from '@/lib/consts'
import { Chain, configureChains, createClient, mainnet, WagmiConfig } from 'wagmi'
import { ConnectKitProvider, getDefaultClient } from 'connectkit'
import { arbitrumGoerli } from 'wagmi/chains'
import { alchemyProvider } from 'wagmi/providers/alchemy';
import { JsonRpcProvider } from '@ethersproject/providers'

const { chains, provider } = configureChains(
  [wallaby, arbitrumGoerli, mainnet],
  [
    alchemyProvider({ apiKey: process.env.NEXT_PUBLIC_ALCHEMY_ID, }),
    (chain: Chain) => ({
      chain,
      provider: () => {
        if (chain.id === wallaby.id || chain.id === hyperspace.id) {
          return new JsonRpcProvider({
            url: chain.rpcUrls.private.http[0],
            headers: { "Authorization": `Bearer ${process.env.NEXT_PUBLIC_GLIF_RPC_AUTH_TOKEN}` },
          },
            { chainId: chain.id, name: chain.network }
          )
        } else {
          return new JsonRpcProvider({
            url: chain.rpcUrls.default.http[0],
          },
            { chainId: chain.id, name: chain.network }
          )
        }
      }
    }),
    // publicProvider()
  ],
  {
    pollingInterval: 1_000,
  }
)

const { connectors } = createClient(
  getDefaultClient({
    appName: APP_NAME,
    autoConnect: false,
    chains,
  })
)

const client = createClient({
  autoConnect: false,
  connectors,
  provider,
})

const Web3Provider = ({ children }) => {
  const { resolvedTheme } = useTheme()

  return (
    <WagmiConfig client={client}>
      <ConnectKitProvider mode={resolvedTheme as 'light' | 'dark'}>{children}</ConnectKitProvider>
    </WagmiConfig>
  )
}

export default Web3Provider
