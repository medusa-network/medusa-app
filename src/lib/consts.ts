import { Address, Chain } from "wagmi"
import { arbitrumGoerli } from "wagmi/chains"

export const APP_NAME = 'OnlyFiles' as const

export const wallaby: Chain = {
  id: 31415,
  name: 'Wallaby Testnet',
  network: 'wallaby',
  nativeCurrency: {
    decimals: 18,
    name: 'Filecoin',
    symbol: 'tFil',
  },
  rpcUrls: {
    default: { http: ['https://wallaby.node.glif.io/rpc/v1'] },
    private: { http: ['https://archive.wallaby.node.glif.io/lotus/rpc/v1'] },
    // private: { http: ['https://hyperspace.node.glif.io/archive/lotus/rpc/v1'] },
  },
  blockExplorers: {
    default: { name: 'Glif', url: 'https://explorer.glif.io' },
  },
  // testnet: true,
}

export const hyperspace: Chain = {
  id: 3141,
  name: 'Hyperspace Testnet',
  network: 'hyperspace',
  nativeCurrency: {
    decimals: 18,
    name: 'Filecoin',
    symbol: 'tFil',
  },
  rpcUrls: {
    default: { http: ['https://hyperspace.node.glif.io/rpc/v1'] },
    private: { http: ['https://hyperspace.node.glif.io/archive/lotus/rpc/v1'] },
  },
  blockExplorers: {
    default: { name: 'Glif', url: 'https://explorer.glif.io' },
  },
  // testnet: true,
}

type ChainId = number
type Config = {
  appContractAddress: Address,
  oracleContractAddress: Address,
}

export const CHAIN_CONFIG: Record<ChainId, Config> = {
  [wallaby.id]: {
    appContractAddress: '0x543e5568C36127E0584D32aeC08B3d28F444b050',
    oracleContractAddress: '0xa043c1f92162c0d204391a1ad05a4aca3538fc7c',
  },
  [arbitrumGoerli.id]: {
    appContractAddress: '0xDbf5B82C9b3Cd8291878b4d355368ab6e32b9A14',
    oracleContractAddress: '0xf1d5A4481F44fe0818b6E7Ef4A60c0c9b29E3118',
  },
} as const


// The <const> assertion enables wagmi to infer the correct types when using the ABI in hooks
export const CONTRACT_ABI = <const>[
  {
    "inputs": [
      {
        "internalType": "contract BN254EncryptionOracle",
        "name": "_oracle",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "CallbackNotAuthorized",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InsufficentFunds",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ListingDoesNotExist",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "requestId",
        "type": "uint256"
      },
      {
        "components": [
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "x",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "y",
                "type": "uint256"
              }
            ],
            "internalType": "struct G1Point",
            "name": "random",
            "type": "tuple"
          },
          {
            "internalType": "uint256",
            "name": "cipher",
            "type": "uint256"
          },
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "x",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "y",
                "type": "uint256"
              }
            ],
            "internalType": "struct G1Point",
            "name": "random2",
            "type": "tuple"
          },
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "f",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "e",
                "type": "uint256"
              }
            ],
            "internalType": "struct DleqProof",
            "name": "dleq",
            "type": "tuple"
          }
        ],
        "indexed": false,
        "internalType": "struct Ciphertext",
        "name": "ciphertext",
        "type": "tuple"
      }
    ],
    "name": "ListingDecryption",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "seller",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "cipherId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "description",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "price",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "uri",
        "type": "string"
      }
    ],
    "name": "NewListing",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "buyer",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "seller",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "requestId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "cipherId",
        "type": "uint256"
      }
    ],
    "name": "NewSale",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "cipherId",
        "type": "uint256"
      },
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "x",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "y",
            "type": "uint256"
          }
        ],
        "internalType": "struct G1Point",
        "name": "buyerPublicKey",
        "type": "tuple"
      }
    ],
    "name": "buyListing",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "x",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "y",
                "type": "uint256"
              }
            ],
            "internalType": "struct G1Point",
            "name": "random",
            "type": "tuple"
          },
          {
            "internalType": "uint256",
            "name": "cipher",
            "type": "uint256"
          },
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "x",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "y",
                "type": "uint256"
              }
            ],
            "internalType": "struct G1Point",
            "name": "random2",
            "type": "tuple"
          },
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "f",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "e",
                "type": "uint256"
              }
            ],
            "internalType": "struct DleqProof",
            "name": "dleq",
            "type": "tuple"
          }
        ],
        "internalType": "struct Ciphertext",
        "name": "cipher",
        "type": "tuple"
      },
      {
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "description",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "price",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "uri",
        "type": "string"
      }
    ],
    "name": "createListing",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "listings",
    "outputs": [
      {
        "internalType": "address",
        "name": "seller",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "price",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "uri",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "oracle",
    "outputs": [
      {
        "internalType": "contract BN254EncryptionOracle",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "requestId",
        "type": "uint256"
      },
      {
        "components": [
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "x",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "y",
                "type": "uint256"
              }
            ],
            "internalType": "struct G1Point",
            "name": "random",
            "type": "tuple"
          },
          {
            "internalType": "uint256",
            "name": "cipher",
            "type": "uint256"
          },
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "x",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "y",
                "type": "uint256"
              }
            ],
            "internalType": "struct G1Point",
            "name": "random2",
            "type": "tuple"
          },
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "f",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "e",
                "type": "uint256"
              }
            ],
            "internalType": "struct DleqProof",
            "name": "dleq",
            "type": "tuple"
          }
        ],
        "internalType": "struct Ciphertext",
        "name": "cipher",
        "type": "tuple"
      }
    ],
    "name": "oracleResult",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "dest",
        "type": "address"
      }
    ],
    "name": "payments",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "publicKey",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "x",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "y",
            "type": "uint256"
          }
        ],
        "internalType": "struct G1Point",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address payable",
        "name": "payee",
        "type": "address"
      }
    ],
    "name": "withdrawPayments",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
]
