import {
  SecretKey,
  PublicKey,
  HGamalEVMCipher as Ciphertext,
  Medusa,
} from '@medusa-network/medusa-sdk'
import { BigNumber } from 'ethers'
import create from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { deserialize, serialize } from 'wagmi' // For BigNumber serialization

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
  sessionDecryptions: Decryption[]

  updateMedusa: (medusa: Medusa<SecretKey, PublicKey<SecretKey>> | null) => void
  updateListings: (listings: Listing[]) => void
  updateSales: (sales: Sale[]) => void
  updateDecryptions: (decryptions: Decryption[]) => void
  clearSessionDecryptions: () => void

  addListing: (listing: Listing) => void
  addSale: (sale: Sale) => void
  addDecryption: (decryption: Decryption) => void
}

// Helper to get a unique storage key per chain/contract
const getStorageKey = (chainId: number | undefined, contractAddress: string | undefined) => {
  return `listingsCache_${chainId || 'unknown'}_${contractAddress || 'unknown'}`;
}

const useGlobalStore = create<GlobalState>()(
  persist(
    (set, get) => ({
      medusa: null,
      listings: [],
      sales: [],
      decryptions: [],
      sessionDecryptions: [],

      updateMedusa: (medusa: Medusa<SecretKey, PublicKey<SecretKey>> | null) =>
        set((state) => ({ medusa })),
      
      // Replaces all listings - used for initial load from cache or full refresh
      updateListings: (listings: Listing[]) => set((state) => ({ listings })),
      
      updateSales: (sales: Sale[]) => set((state) => ({ sales })), // Not caching sales for now
      updateDecryptions: (decryptions: Decryption[]) => set((state) => ({ decryptions })), // Not caching decryptions
      clearSessionDecryptions: () => set((state) => ({ sessionDecryptions: [] })),

      // Adds a single listing, ensuring no duplicates
      addListing: (listing: Listing) =>
        set(({ listings }) => {
          if (!listings.find((l) => l.cipherId.eq(listing.cipherId))) {
            console.log("Adding listing to store:", listing); // Log addition
            return { listings: [listing, ...listings].sort((a, b) => b.cipherId.sub(a.cipherId).toNumber()) }; // Keep sorted
          }
          console.log("Skipping duplicate listing in store:", listing); // Log skip
          return { listings } // No change if duplicate
        }),

      addSale: (sale: Sale) =>
        set(({ sales }) => {
          // Needed because of duplicate events bug in FVM
          // Use .eq() for BigNumber comparison for requestId as well
          if (!sales.find((s) => s.requestId.eq(sale.requestId))) { 
            return { sales: [sale, ...sales] }
          }
          return { sales }
        }),

      addDecryption: (decryption: Decryption) =>
        set(({ decryptions, sessionDecryptions }) => {
          // Check if this decryption already exists in the main decryptions array
          const existsInMain = decryptions.find((d) => d.requestId.eq(decryption.requestId));
          
          // Check if this decryption already exists in the session decryptions array
          const existsInSession = sessionDecryptions.find((d) => d.requestId.eq(decryption.requestId));
          
          // Update both arrays if needed
          return { 
            decryptions: existsInMain ? decryptions : [decryption, ...decryptions],
            sessionDecryptions: existsInSession ? sessionDecryptions : [decryption, ...sessionDecryptions]
          };
        }),
    }),
    {
      name: 'global-store-cache', // Base name for zustand persist middleware
      storage: createJSONStorage(() => localStorage, {
        replacer: (key, value) => {
          // Handle BigNumber serialization for listings
          if (key === 'listings' && Array.isArray(value)) {
            return value.map(listing => serialize(listing));
          }
          return value;
        },
        reviver: (key, value) => {
          // Handle BigNumber deserialization for listings
          if (key === 'listings' && Array.isArray(value)) {
            return value.map(serializedListing => {
              try {
                // Need to specify the expected type structure for deserialize
                // Assuming Listing structure defined earlier
                return deserialize(serializedListing);
              } catch (e) {
                console.error("Failed to deserialize listing:", serializedListing, e);
                return null; // Handle potential errors during deserialization
              }
            }).filter(l => l !== null); // Filter out any nulls from failed deserialization
          }
          return value;
        },
      }),
      partialize: (state) => ({
        listings: state.listings, // Only persist listings
      }),
      // Implement versioning and migration if state structure changes significantly later
      // version: 1, 
      // migrate: (persistedState, version) => { ... }
    }
  )
)

export default useGlobalStore
