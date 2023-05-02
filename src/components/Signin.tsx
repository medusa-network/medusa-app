import { FC } from "react";
import useGlobalStore from "@/stores/globalStore";
import { Medusa } from "@medusa-network/medusa-sdk";
import { CHAIN_CONFIG } from "@/lib/consts";
import { useNetwork, useSigner } from "wagmi";

const Signin: FC = () => {
  const { chain } = useNetwork();
  const medusa = useGlobalStore((state) => state.medusa);
  const updateMedusa = useGlobalStore((state) => state.updateMedusa);
  const { data: signer } = useSigner();

  const signMessage = async () => {
    if (!signer) return;
    const medusa = await Medusa.init(
      CHAIN_CONFIG[chain?.id]?.oracleContractAddress,
      signer,
      "localhost",
    );
    await medusa.signForKeypair();
    updateMedusa(medusa);
  };

  if (medusa?.keypair) {
    return (
      <button
        className="bg-gray-700 hover:bg-gray-500 hover:cursor-pointer text-gray-50 py-2 px-4 rounded"
        onClick={() => medusa.setKeypair(null)}
      >
        Sign out
      </button>
    );
  }

  return (
    <button
      className="bg-gray-700 hover:bg-gray-500 hover:cursor-pointer text-gray-50 py-2 px-4 rounded"
      onClick={() => signMessage()}
    >
      Sign in
    </button>
  );
};

export default Signin;
