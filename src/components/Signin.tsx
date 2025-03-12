import { FC } from 'react'
import useMedusa from '@/hooks/useMedusa'
import { useNetwork } from 'wagmi'

interface SigninProps {
  text: string
}

const Signin: FC<SigninProps> = ({ text = 'Sign in' }) => {
  const { signed, signMessage } = useMedusa()
  const { chain } = useNetwork()
  
  const isHoleskyNetwork = chain?.id === 17000
  
  // If not on Holesky, show a warning message
  if (!isHoleskyNetwork) {
    return (
      <button className="btn-secondary bg-red-600 hover:bg-red-700" disabled>
        Switch to Holesky Network
      </button>
    )
  }

  if (!signed) {
    return (
      <button className="btn-secondary" onClick={() => signMessage()}>
        {text}
      </button>
    )
  }
  
  return null
}

export default Signin
