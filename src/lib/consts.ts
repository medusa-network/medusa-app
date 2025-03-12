import { Address } from 'wagmi'
import { mainnet } from 'wagmi/chains'

export const APP_NAME = 'OnlyFiles' as const

// Define Arbitrum Sepolia manually since it might not be properly defined in the current wagmi version
export const arbitrumSepolia = {
  id: 421614,
  name: 'Arbitrum Sepolia',
  network: 'arbitrum-sepolia',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://sepolia-rollup.arbitrum.io/rpc'],
    },
    public: {
      http: ['https://sepolia-rollup.arbitrum.io/rpc'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Arbiscan',
      url: 'https://sepolia.arbiscan.io',
    },
  },
  testnet: true,
}

// Define Holesky testnet
export const holesky = {
  id: 17000,
  name: 'Holesky',
  network: 'holesky',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [
        'https://ethereum-holesky.publicnode.com',
        'https://holesky.rpc.thirdweb.com',
        'https://holesky.blockpi.network/v1/rpc/public',
        'https://1rpc.io/holesky',
        'https://rpc.ankr.com/eth_holesky'
      ],
    },
    public: {
      http: [
        'https://ethereum-holesky.publicnode.com',
        'https://holesky.rpc.thirdweb.com',
        'https://holesky.blockpi.network/v1/rpc/public',
        'https://1rpc.io/holesky',
        'https://rpc.ankr.com/eth_holesky'
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'Etherscan',
      url: 'https://holesky.etherscan.io',
    },
  },
  testnet: true,
}

type ChainId = number
type Config = {
  appContractAddress: Address
  oracleContractAddress: Address
}

export const CHAIN_CONFIG: Record<ChainId, Config> = {
  [arbitrumSepolia.id]: {
    appContractAddress: '0xDbf5B82C9b3Cd8291878b4d355368ab6e32b9A14',
    oracleContractAddress: '0xf1d5A4481F44fe0818b6E7Ef4A60c0c9b29E3118',
  },
  [holesky.id]: {
    appContractAddress: process.env.NEXT_PUBLIC_ONLYFILES_ADDRESS as Address || '0x5567aca23bE9a5899010a4D3fA83b9da2B947256',
    oracleContractAddress: process.env.NEXT_PUBLIC_ORACLE_ADDRESS as Address || '0xb0C60D71432829021525995249538353b148ED30',
  },
} as const

// The <const> assertion enables wagmi to infer the correct types when using the ABI in hooks
export const CONTRACT_ABI = <const>[
  {
    inputs: [
      {
        internalType: 'contract BN254EncryptionOracle',
        name: '_oracle',
        type: 'address',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [],
    name: 'CallbackNotAuthorized',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InsufficentFunds',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ListingDoesNotExist',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'requestId',
        type: 'uint256',
      },
      {
        components: [
          {
            components: [
              {
                internalType: 'uint256',
                name: 'x',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'y',
                type: 'uint256',
              },
            ],
            internalType: 'struct G1Point',
            name: 'random',
            type: 'tuple',
          },
          {
            internalType: 'uint256',
            name: 'cipher',
            type: 'uint256',
          },
          {
            components: [
              {
                internalType: 'uint256',
                name: 'x',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'y',
                type: 'uint256',
              },
            ],
            internalType: 'struct G1Point',
            name: 'random2',
            type: 'tuple',
          },
          {
            components: [
              {
                internalType: 'uint256',
                name: 'f',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'e',
                type: 'uint256',
              },
            ],
            internalType: 'struct DleqProof',
            name: 'dleq',
            type: 'tuple',
          },
        ],
        indexed: false,
        internalType: 'struct Ciphertext',
        name: 'ciphertext',
        type: 'tuple',
      },
    ],
    name: 'ListingDecryption',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'seller',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'uint256',
        name: 'cipherId',
        type: 'uint256',
      },
      {
        components: [
          {
            components: [
              {
                internalType: 'uint256',
                name: 'x',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'y',
                type: 'uint256',
              },
            ],
            internalType: 'struct G1Point',
            name: 'random',
            type: 'tuple',
          },
          {
            internalType: 'uint256',
            name: 'cipher',
            type: 'uint256',
          },
          {
            components: [
              {
                internalType: 'uint256',
                name: 'x',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'y',
                type: 'uint256',
              },
            ],
            internalType: 'struct G1Point',
            name: 'random2',
            type: 'tuple',
          },
          {
            components: [
              {
                internalType: 'uint256',
                name: 'f',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'e',
                type: 'uint256',
              },
            ],
            internalType: 'struct DleqProof',
            name: 'dleq',
            type: 'tuple',
          },
        ],
        indexed: false,
        internalType: 'struct Ciphertext',
        name: 'ciphertext',
        type: 'tuple',
      },
      {
        indexed: false,
        internalType: 'string',
        name: 'name',
        type: 'string',
      },
      {
        indexed: false,
        internalType: 'string',
        name: 'description',
        type: 'string',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'price',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'string',
        name: 'uri',
        type: 'string',
      },
    ],
    name: 'NewListing',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'buyer',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'seller',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'requestId',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'cipherId',
        type: 'uint256',
      },
    ],
    name: 'NewSale',
    type: 'event',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'cipherId',
        type: 'uint256',
      },
      {
        components: [
          {
            internalType: 'uint256',
            name: 'x',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'y',
            type: 'uint256',
          },
        ],
        internalType: 'struct G1Point',
        name: 'buyerPublicKey',
        type: 'tuple',
      },
    ],
    name: 'buyListing',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          {
            components: [
              {
                internalType: 'uint256',
                name: 'x',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'y',
                type: 'uint256',
              },
            ],
            internalType: 'struct G1Point',
            name: 'random',
            type: 'tuple',
          },
          {
            internalType: 'uint256',
            name: 'cipher',
            type: 'uint256',
          },
          {
            components: [
              {
                internalType: 'uint256',
                name: 'x',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'y',
                type: 'uint256',
              },
            ],
            internalType: 'struct G1Point',
            name: 'random2',
            type: 'tuple',
          },
          {
            components: [
              {
                internalType: 'uint256',
                name: 'f',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'e',
                type: 'uint256',
              },
            ],
            internalType: 'struct DleqProof',
            name: 'dleq',
            type: 'tuple',
          },
        ],
        internalType: 'struct Ciphertext',
        name: 'cipher',
        type: 'tuple',
      },
      {
        internalType: 'string',
        name: 'name',
        type: 'string',
      },
      {
        internalType: 'string',
        name: 'description',
        type: 'string',
      },
      {
        internalType: 'uint256',
        name: 'price',
        type: 'uint256',
      },
      {
        internalType: 'string',
        name: 'uri',
        type: 'string',
      },
    ],
    name: 'createListing',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    name: 'listings',
    outputs: [
      {
        internalType: 'address',
        name: 'seller',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'price',
        type: 'uint256',
      },
      {
        internalType: 'string',
        name: 'uri',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'oracle',
    outputs: [
      {
        internalType: 'contract BN254EncryptionOracle',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'requestId',
        type: 'uint256',
      },
      {
        components: [
          {
            components: [
              {
                internalType: 'uint256',
                name: 'x',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'y',
                type: 'uint256',
              },
            ],
            internalType: 'struct G1Point',
            name: 'random',
            type: 'tuple',
          },
          {
            internalType: 'uint256',
            name: 'cipher',
            type: 'uint256',
          },
          {
            components: [
              {
                internalType: 'uint256',
                name: 'x',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'y',
                type: 'uint256',
              },
            ],
            internalType: 'struct G1Point',
            name: 'random2',
            type: 'tuple',
          },
          {
            components: [
              {
                internalType: 'uint256',
                name: 'f',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'e',
                type: 'uint256',
              },
            ],
            internalType: 'struct DleqProof',
            name: 'dleq',
            type: 'tuple',
          },
        ],
        internalType: 'struct Ciphertext',
        name: 'cipher',
        type: 'tuple',
      },
    ],
    name: 'oracleResult',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'dest',
        type: 'address',
      },
    ],
    name: 'payments',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'publicKey',
    outputs: [
      {
        components: [
          {
            internalType: 'uint256',
            name: 'x',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'y',
            type: 'uint256',
          },
        ],
        internalType: 'struct G1Point',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address payable',
        name: 'payee',
        type: 'address',
      },
    ],
    name: 'withdrawPayments',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]

export const ORACLE_ABI = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'id',
        type: 'uint256'
      },
      {
        components: [
          {
            components: [
              {
                internalType: 'uint256',
                name: 'x',
                type: 'uint256'
              },
              {
                internalType: 'uint256',
                name: 'y',
                type: 'uint256'
              }
            ],
            internalType: 'struct G1Point',
            name: 'random',
            type: 'tuple'
          },
          {
            internalType: 'uint256',
            name: 'cipher',
            type: 'uint256'
          },
          {
            components: [
              {
                internalType: 'uint256',
                name: 'x',
                type: 'uint256'
              },
              {
                internalType: 'uint256',
                name: 'y',
                type: 'uint256'
              }
            ],
            internalType: 'struct G1Point',
            name: 'random2',
            type: 'tuple'
          },
          {
            components: [
              {
                internalType: 'uint256',
                name: 'f',
                type: 'uint256'
              },
              {
                internalType: 'uint256',
                name: 'e',
                type: 'uint256'
              }
            ],
            internalType: 'struct DleqProof',
            name: 'dleq',
            type: 'tuple'
          }
        ],
        internalType: 'struct Ciphertext',
        name: 'ciphertext',
        type: 'tuple'
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'client',
        type: 'address'
      }
    ],
    name: 'NewCiphertext',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'cipherId',
        type: 'uint256'
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'requestId',
        type: 'uint256'
      },
      {
        components: [
          {
            internalType: 'uint256',
            name: 'x',
            type: 'uint256'
          },
          {
            internalType: 'uint256',
            name: 'y',
            type: 'uint256'
          }
        ],
        internalType: 'struct G1Point',
        name: 'publicKey',
        type: 'tuple'
      },
      {
        components: [
          {
            internalType: 'address',
            name: 'client',
            type: 'address'
          },
          {
            internalType: 'uint96',
            name: 'fee',
            type: 'uint96'
          }
        ],
        internalType: 'struct PendingRequest',
        name: 'request',
        type: 'tuple'
      }
    ],
    name: 'ReencryptionRequest',
    type: 'event'
  }
] as const;
