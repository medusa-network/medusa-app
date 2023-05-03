import { CHAIN_CONFIG, CONTRACT_ABI } from '@/lib/consts'
import { ipfsGatewayLink } from '@/lib/utils'
import useMedusa from '@/hooks/useMedusa'
import useGlobalStore, { Listing } from '@/stores/globalStore'
import { BigNumber } from 'ethers'
import { formatEther } from 'ethers/lib/utils'
import { FC } from 'react'
import toast from 'react-hot-toast'
import {
  useAccount,
  useContractWrite,
  useNetwork,
  usePrepareContractWrite,
  useWaitForTransaction,
} from 'wagmi'
import Signin from '@/components/Signin'

const Listing: FC<Listing & { purchased: boolean }> = ({
  cipherId,
  uri,
  name,
  description,
  price,
  purchased,
}) => {
  const { isConnected } = useAccount()
  const { medusa } = useMedusa()
  const { chain } = useNetwork()

  let buyerPublicKey = null
  if (medusa?.keypair) {
    const { x, y } = medusa.keypair.pubkey.toEvm()
    buyerPublicKey = { x, y }
  }

  const { config } = usePrepareContractWrite({
    address: CHAIN_CONFIG[chain?.id]?.appContractAddress,
    abi: CONTRACT_ABI,
    functionName: 'buyListing',
    args: [cipherId, buyerPublicKey],
    enabled: Boolean(buyerPublicKey) && Boolean(chain),
    overrides: { value: price },
    chainId: chain?.id,
  })

  const { data, write: buyListing } = useContractWrite(config)

  useWaitForTransaction({
    hash: data?.hash,
    onSuccess: (txData) => {
      toast.dismiss()
      toast.success(
        <a
          href={`https://goerli.arbiscan.io/tx/${txData.transactionHash}`}
          className="inline-flex items-center text-blue-600 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Secret successfully unlocked with Medusa! View on Etherscan
          <svg
            className="ml-2 w-5 h-5"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"></path>
            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"></path>
          </svg>
        </a>,
      )
    },
    onError: (e) => {
      toast.dismiss()
      toast.error(`Failed to unlock secret: ${e.message}`)
    },
  })

  const unlockSecret = async () => {
    toast.loading('Unlocking secret...')
    buyListing?.()
  }

  return (
    <div className="p-6 max-w-sm bg-white rounded-lg border border-gray-200 shadow-md dark:bg-gray-800 dark:border-gray-700">
      <h5 className="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white truncate">
        {name}
      </h5>
      <p className="mb-3 font-normal text-gray-400">{description}</p>
      <p className="mb-3 text-dark-secondary">
        {BigNumber.from(0).eq(price)
          ? 'Free'
          : `${formatEther(price)} ETH`}{' '}
      </p>
      {buyerPublicKey ? (
        <button
          disabled={!isConnected || purchased}
          className="btn-secondary"
          onClick={() => unlockSecret()}
        >
          {purchased ? 'Purchased' : 'Buy Now'}
        </button>
      ) : (
        <Signin text="Sign to Buy" />
      )}
    </div>
  )
}

export default Listing
