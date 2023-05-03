import { FC, useState, useEffect } from 'react'
import {
  usePrepareContractWrite,
  useContractWrite,
  useWaitForTransaction,
  useNetwork,
  useAccount,
} from 'wagmi'
import { HGamalEVMCipher } from '@medusa-network/medusa-sdk'

import { CHAIN_CONFIG, CONTRACT_ABI } from '@/lib/consts'
import { parseEther } from 'ethers/lib/utils'
import storeCiphertext from '@/lib/storeCiphertext'
import toast from 'react-hot-toast'
import { ipfsGatewayLink } from '@/lib/utils'
import { Base64 } from 'js-base64'
import useMedusa from '@/hooks/useMedusa'

const ListingForm: FC = () => {
  const { chain } = useNetwork()
  const { medusa, signed: medusaSigned, signMessage } = useMedusa()
  const { isConnected } = useAccount()

  const [name, setName] = useState<string | null>()
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')

  const [plaintext, setPlaintext] = useState('')
  const [ciphertextKey, setCiphertextKey] = useState<HGamalEVMCipher>()
  const [cid, setCid] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const {
    config,
    error: prepareError,
    isError: isPrepareError,
    isSuccess: readyToSendTransaction,
  } = usePrepareContractWrite({
    address: CHAIN_CONFIG[chain?.id]?.appContractAddress,
    abi: CONTRACT_ABI,
    functionName: 'createListing',
    args: [
      ciphertextKey,
      name,
      description,
      parseEther(price || '0.00'),
      `ipfs://${cid}/${name}`,
    ],
    enabled: Boolean(cid) && Boolean(chain),
    chainId: chain?.id,
  })

  const {
    data,
    error,
    isError,
    write: createListing,
  } = useContractWrite(config)

  useEffect(() => {
    if (readyToSendTransaction) {
      toast.loading('Submitting secret to Medusa...')
      createListing?.()
      setCid('')
    }
  }, [readyToSendTransaction])

  const { isLoading, isSuccess } = useWaitForTransaction({
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
          Secret successfully submitted to Medusa! View on Etherscan
          <svg
            className="ml-2 w-5 h-5"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
          </svg>
        </a>,
      )
    },
    onError: (e) => {
      toast.dismiss()
      toast.error(`Failed to submit secret to Medusa: ${e.message}`)
    },
  })

  const handleSubmit = async (event: any) => {
    event.preventDefault()
    setSubmitting(true)
    let signedMedusa = medusa
    if (!medusaSigned) {
      signedMedusa = await signMessage()
    }

    console.log('Submitting new listing')

    const buff = new TextEncoder().encode(plaintext)
    await signedMedusa.fetchPublicKey()
    try {
      const { encryptedData, encryptedKey } = await signedMedusa.encrypt(
        buff,
        CHAIN_CONFIG[chain.id].appContractAddress,
      )
      const b64EncryptedData = Base64.fromUint8Array(encryptedData)
      console.log('Encrypted KEY: ', encryptedKey)
      setCiphertextKey(encryptedKey)

      toast.promise(storeCiphertext(name, b64EncryptedData), {
        loading: 'Uploading encrypted secret to IPFS...',
        success: (cid) => {
          setCid(cid)
          return (
            <a
              href={ipfsGatewayLink(cid)}
              className="inline-flex items-center text-blue-600 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              View secret on IPFS
              <svg
                className="ml-2 w-5 h-5"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
              </svg>
            </a>
          )
        },
        error: (error) => `Error uploading to IPFS: ${error.message}`,
      })
    } catch (e) {
      console.log('Encryption or storeCiphertext API call Failed: ', e)
    }
    setSubmitting(false)
  }

  const handleFileChange = (event: any) => {
    toast.success('File uploaded successfully!')
    const file = event.target.files[0]
    setName(file.name)
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const plaintext = event.target?.result as string
      setPlaintext(plaintext)
    }
    reader.onerror = (error) => {
      console.log('File Input Error: ', error)
    }
  }

  return (
    <>
      <form className="lg:w-1/2 lg:mx-auto" onSubmit={handleSubmit}>
        <div className="flex items-center justify-center">
          <label className="w-64 flex flex-col bg-gray-800 items-center px-4 py-6 rounded-lg shadow-lg tracking-wide border-2 hover:border-dark-secondary cursor-pointer hover:bg-off-white hover:text-dark-secondary transition-colors">
            <svg
              className="w-8 h-8"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
            >
              <path d="M16.88 9.1A4 4 0 0 1 16 17H5a5 5 0 0 1-1-9.9V7a3 3 0 0 1 4.52-2.59A4.98 4.98 0 0 1 17 8c0 .38-.04.74-.12 1.1zM11 11h3l-4-4-4 4h3v3h2v-3z" />
            </svg>
            <span className="mt-2 text-base leading-normal">
              {name ?? 'SELECT A FILE'}
            </span>
            <input type='file' className="hidden" onChange={handleFileChange} />
          </label>
        </div>

        <div className="flex flex-row mt-5 justify-center space-x-10">
          <div className="text-center">
            <label className="block">
              <span className="text-lg my-4">Name</span>
              <input
                required
                type="text"
                placeholder="filename.txt"
                className="form-input rounded my-5 block w-full focus:ring-orange-700 border-off-white focus:border-dark-secondary text-off-white bg-gray-800"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          </div>

          <div className="text-center">
            <label className="block">
              <span className="text-lg my-4">Price</span>
              <input
                required
                type="number"
                placeholder="ETH"
                className="form-input rounded my-5 block w-full focus:ring-orange-700 border-off-white focus:border-dark-secondary text-off-white bg-gray-800"
                value={price}
                min={0}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="pt-4 text-center">
          <span className="text-lg my-4">Description</span>
          <label className="py-3 block">
            <textarea
              required
              className="form-textarea rounded mt-1 block w-full h-24 focus:ring-orange-700 border-off-white focus:border-dark-secondary text-off-white bg-gray-800"
              rows={3}
              placeholder="Buy access to my top secret file!"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>
        <div className="text-center w-full">
          <button
            type="submit"
            disabled={isLoading || submitting || !isConnected}
            className="btn-primary font-semibold mt-5 text-xl py-4 px-4 disabled:cursor-not-allowed disabled:opacity-25"
          >
            {isLoading || submitting
              ? 'Submitting...'
              : isConnected
              ? 'Sell your Secret'
              : 'Connect your Wallet'}
          </button>
        </div>
        {(isPrepareError || isError) && (
          <div>Error: {(prepareError || error)?.message}</div>
        )}
      </form>
    </>
  )
}

export default ListingForm
