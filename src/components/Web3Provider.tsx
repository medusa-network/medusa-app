import { useTheme } from 'next-themes'
import {
  Chain,
  configureChains,
  createClient,
  mainnet,
  WagmiConfig,
} from 'wagmi'
import { MetaMaskConnector } from 'wagmi/connectors/metaMask'
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect'
import { CoinbaseWalletConnector } from 'wagmi/connectors/coinbaseWallet'
import { InjectedConnector } from 'wagmi/connectors/injected'
import { arbitrumGoerli } from 'wagmi/chains'
import { alchemyProvider } from 'wagmi/providers/alchemy'
import { ConnectKitProvider, getDefaultClient } from 'connectkit'
import { JsonRpcProvider } from '@ethersproject/providers'

import { APP_NAME, hyperspace } from '@/lib/consts'
import useChains from '@/hooks/useChains'

type DefaultConnectorsProps = {
  chains?: Chain[]
  appName: string
}

const getDefaultConnectors = ({ chains, appName }: DefaultConnectorsProps) => {
  return [
    new MetaMaskConnector({
      chains,
      options: {
        shimDisconnect: true,
        shimChainChangedDisconnect: true,
        UNSTABLE_shimOnConnectSelectAccount: false,
      },
    }),
    new CoinbaseWalletConnector({
      chains,
      options: {
        appName,
        headlessMode: true,
      },
    }),
    new WalletConnectConnector({
      chains,
      options: {
        qrcode: false,
      },
    }),
    new InjectedConnector({
      chains,
      options: {
        shimDisconnect: true,
        name: (detectedName) =>
          `Injected (${
            typeof detectedName === 'string'
              ? detectedName
              : detectedName.join(', ')
          })`,
      },
    }),
  ]
}

const Web3Provider = ({ children }) => {
  const { resolvedTheme } = useTheme()
  const { defaultChain, supportedChains } = useChains()

  const { chains, provider } = configureChains(
    supportedChains,
    [
      alchemyProvider({ apiKey: process.env.NEXT_PUBLIC_ALCHEMY_ID }),
      (chain: Chain) => ({
        chain,
        provider: () => {
          if (chain.id === hyperspace.id) {
            return new JsonRpcProvider(
              {
                url: chain.rpcUrls.private.http[0],
                headers: {
                  Authorization: `Bearer ${process.env.NEXT_PUBLIC_GLIF_RPC_AUTH_TOKEN}`,
                },
              },
              { chainId: chain.id, name: chain.network },
            )
          } else {
            return new JsonRpcProvider(
              {
                url: chain.rpcUrls.default.http[0],
              },
              { chainId: chain.id, name: chain.network },
            )
          }
        },
      }),
      // publicProvider()
    ],
    {
      pollingInterval: defaultChain.id === arbitrumGoerli.id ? 2_000 : 5_000,
    },
  )

  const connectors = getDefaultConnectors({ chains, appName: APP_NAME })

  const client = createClient({
    autoConnect: true,
    connectors,
    provider,
  })

  return (
    <WagmiConfig client={client}>
      <ConnectKitProvider mode={resolvedTheme as 'light' | 'dark'}>
        {children}
      </ConnectKitProvider>
    </WagmiConfig>
  )
}

export default Web3Provider
