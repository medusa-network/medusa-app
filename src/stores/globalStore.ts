import { SecretKey, PublicKey, HGamalEVMCipher as Ciphertext, Medusa } from '@medusa-network/medusa-sdk'
import { BigNumber } from 'ethers'
import create from 'zustand'

export interface Listing {
  seller: string
  cipherId: BigNumber
  name: string
  description: string
  price: BigNumber
  uri: string
}

export interface Sale {
  buyer: string
  seller: string
  requestId: BigNumber
  cipherId: BigNumber
}

export interface Decryption {
  requestId: BigNumber
  ciphertext: Ciphertext
}

interface GlobalState {
  medusa: Medusa<SecretKey, PublicKey<SecretKey>> | null
  listings: Listing[]
  sales: Sale[]
  decryptions: Decryption[]

  updateMedusa: (medusa: Medusa<SecretKey, PublicKey<SecretKey>> | null) => void
  updateListings: (listings: Listing[]) => void,
  updateSales: (sales: Sale[]) => void
  updateDecryptions: (decryptions: Decryption[]) => void

  addListing: (listing: Listing) => void
  addSale: (sale: Sale) => void
  addDecryption: (decryption: Decryption) => void
}

const useGlobalStore = create<GlobalState>()((set) => ({
  medusa: null,
  listings: [],
  sales: [],
  decryptions: [],

  updateMedusa: (medusa: Medusa<SecretKey, PublicKey<SecretKey>> | null) => set((state) => ({ medusa })),
  updateListings: (listings: Listing[]) => set((state) => ({ listings })),
  updateSales: (sales: []) => set((state) => ({ sales })),
  updateDecryptions: (decryptions: []) => set((state) => ({ decryptions })),

  addListing: (listing: Listing) => set((state) => ({ listings: [listing, ...state.listings] })),
  addSale: (sale: Sale) => set((state) => ({ sales: [sale, ...state.sales] })),
  addDecryption: (decryption: Decryption) => set((state) => ({ decryptions: [decryption, ...state.decryptions] })),
}))

export default useGlobalStore
