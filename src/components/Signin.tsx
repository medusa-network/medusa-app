import { FC } from 'react'
import useMedusa from '@/hooks/useMedusa'

interface SigninProps {
  text: string
}

const Signin: FC<SigninProps> = ({ text = 'Sign in' }) => {
  const { signed, signMessage } = useMedusa()

  if (!signed) {
    return (
      <button className="btn-secondary" onClick={() => signMessage()}>
        {text}
      </button>
    )
  }
}

export default Signin
