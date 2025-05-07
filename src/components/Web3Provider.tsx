import { useTheme } from 'next-themes'
import {
  Chain,
  configureChains,
  createClient,
  WagmiConfig,
} from 'wagmi'
import { MetaMaskConnector } from 'wagmi/connectors/metaMask'
import { mainnet } from 'wagmi/chains'
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc'
import { ReactNode, useEffect } from 'react'

import { APP_NAME, arbitrumSepolia, holesky } from '@/lib/consts'

interface Web3ProviderProps {
  children: ReactNode;
}

// Get all available RPC URLs from environment variables
const getRpcUrls = (): string[] => {
  const urls = [
    process.env.NEXT_PUBLIC_HOLESKY_RPC_URL,
    process.env.NEXT_PUBLIC_HOLESKY_RPC_URL_BACKUP1,
    process.env.NEXT_PUBLIC_HOLESKY_RPC_URL_BACKUP2,
    process.env.NEXT_PUBLIC_HOLESKY_RPC_URL_BACKUP3,
    process.env.NEXT_PUBLIC_HOLESKY_RPC_URL_BACKUP4,
  ].filter(Boolean) as string[];
  
  // If no URLs are found, use default fallbacks
  if (urls.length === 0) {
    return [
      'https://ethereum-holesky.publicnode.com',
      'https://holesky.rpc.thirdweb.com',
      'https://holesky.blockpi.network/v1/rpc/public',
    ];
  }
  
  return urls;
};

// Configure chains & providers with custom networks
// Only include Holesky to force connection to it
const { chains, provider } = configureChains(
  [holesky as Chain], // Only include Holesky to force connection to it
  [
    jsonRpcProvider({
      rpc: (chain) => {
        if (chain.id === holesky.id) {
          const rpcUrls = getRpcUrls();
          console.log("Available RPC URLs:", rpcUrls);
          // Use the first URL as the primary, others are fallbacks
          return { http: rpcUrls[0] };
        }
        // Fallback should never be reached since we only include Holesky
        return { http: 'https://ethereum-holesky.publicnode.com' };
      },
    }),
  ]
)

// Log available chains for debugging
console.log("Available chains:", chains.map(c => ({ id: c.id, name: c.name })));

// Set up client
const client = createClient({
  autoConnect: true,
  connectors: [
    new MetaMaskConnector({ 
      chains,
      options: {
        shimDisconnect: true,
      }
    }),
  ],
  provider,
})

const Web3Provider = ({ children }: Web3ProviderProps) => {
  // Log environment variables for debugging
  useEffect(() => {
    console.log("Environment variables:");
    console.log("NEXT_PUBLIC_ONLYFILES_ADDRESS:", process.env.NEXT_PUBLIC_ONLYFILES_ADDRESS);
    console.log("NEXT_PUBLIC_ORACLE_ADDRESS:", process.env.NEXT_PUBLIC_ORACLE_ADDRESS);
    console.log("NEXT_PUBLIC_CHAIN_ID:", process.env.NEXT_PUBLIC_CHAIN_ID);
    console.log("RPC URLs:", getRpcUrls());
    
    // Alert the user to connect to Holesky
    console.log("Please connect to the Holesky network (Chain ID: 17000) in your wallet");
  }, []);

  return (
    <WagmiConfig client={client}>
      {children}
    </WagmiConfig>
  )
}

export default Web3Provider
