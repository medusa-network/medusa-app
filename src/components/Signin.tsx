import { FC } from 'react'
import useMedusa from '@/hooks/useMedusa'

const Signin: FC = ({ text = 'Sign in' }: { text: string }) => {
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
