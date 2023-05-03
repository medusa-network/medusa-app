import { FC, useEffect, useState } from 'react'
import Image from 'next/image'
import useGlobalStore, { Sale } from '@/stores/globalStore'
import { BigNumber } from 'ethers'
import { formatEther } from 'ethers/lib/utils'
import { Base64 } from 'js-base64'
import { ipfsGatewayLink } from '@/lib/utils'
import { useSigner } from 'wagmi'
import Signin from '@/components/Signin'

const Unlocked: FC<Sale> = ({ buyer, seller, requestId, cipherId }) => {
  const medusa = useGlobalStore((state) => state.medusa)
  const { data: signer, isSuccess: isSignerLoaded } = useSigner()

  const listings = useGlobalStore((state) => state.listings)
  const decryptions = useGlobalStore((state) => state.decryptions)

  const listing = listings.find((listing) => listing.cipherId.eq(cipherId))
  const decryption = decryptions.find((d) => d.requestId.eq(requestId))

  const [plaintext, setPlaintext] = useState<string | null>()
  const [downloadLink, setDownloadLink] = useState('')

  useEffect(() => {
    const decryptContent = async () => {
      if (!decryption || !signer || !medusa?.keypair) return

      const { ciphertext } = decryption

      console.log('Downloading encrypted content from ipfs')
      const ipfsDownload = ipfsGatewayLink(listing.uri)
      const response = await fetch(ipfsDownload)
      const encryptedContents = Base64.toUint8Array(await response.text())

      try {
        const decryptedBytes = await medusa.decrypt(
          ciphertext,
          encryptedContents,
        )
        const msg = new TextDecoder().decode(decryptedBytes)
        setPlaintext(msg)
        if (isFile(msg)) {
          const fileData = msg.split(',')[1]
          setDownloadLink(
            window.URL.createObjectURL(
              new Blob([Base64.toUint8Array(fileData)]),
            ),
          )
        } else {
          setDownloadLink(window.URL.createObjectURL(new Blob([msg])))
        }
      } catch (e) {
        setPlaintext('Decryption failed')
      }
    }
    decryptContent()
  }, [decryption, listing.uri, isSignerLoaded, medusa?.keypair])

  const isFile = (data: string) => {
    return data.startsWith('data:')
  }

  const isImage = (data: string): Boolean => {
    return data.startsWith('data:image')
  }

  return (
    <div className="p-6 max-w-sm bg-white rounded-lg border border-gray-200 shadow-md dark:bg-gray-800 dark:border-gray-700">
      <h5 className="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white truncate">
        {listing.name}
      </h5>
      <p className="mb-3 font-normal text-gray-700 dark:text-gray-400">
        {listing.description}
      </p>
      <p className="mb-3">
        {BigNumber.from(0).eq(listing.price)
          ? 'Free'
          : `${formatEther(listing.price)} ETH`}{' '}
      </p>

      {plaintext ? (
        isImage(plaintext) ? (
          <Image
            src={plaintext}
            width={300}
            height={300}
            alt="Decrypted Image"
          />
        ) : (
          <textarea
            readOnly
            disabled
            className="form-textarea mt-1 block w-full h-24 dark:bg-gray-800 dark:text-white"
            rows={3}
            placeholder="Encrypted Content"
            value={plaintext}
          />
        )
      ) : (
        <Signin text="Sign to View" />
      )}
      {downloadLink && (
        <a
          href={downloadLink}
          download={listing.name}
          className="inline-flex items-center text-dark-secondary hover:underline float-right"
        >
          Download
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
      )}
    </div>
  )
}

export default Unlocked
