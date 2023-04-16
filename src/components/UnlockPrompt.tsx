import { useState } from 'react';

interface UnlockPromptProps {
  description: string;
}

const UnlockPrompt: React.FC<UnlockPromptProps> = ({ description }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);

  const handleUnlock = () => {
    if (!isUnlocked) {
      setIsUnlocked(true);
    }
  };

  return (
    <div className="flex flex-col items-center relative">
      <div className="group border-[1px] border-off-white">
        <div
          className={`p-4 bg-lighter-primary text-off-white rounded-lg border-2 border-dark-secondary blur-[8px] opacity-30 sm:opacity-100 group-hover:opacity-30`}
          onClick={handleUnlock}
        >
          <div className="font-bold">🤖 ChatGPT:</div>
          <div>Hello! How can I help you today?</div>
          <div className="mt-2 font-bold text-right">👤 User:</div>
          <div className="text-right">I need assistance with my project.</div>
          <div className="mt-2 font-bold">🤖 ChatGPT:</div>
          <div className="text-right">Of course! What do you need help with?</div>
        </div>

        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-full mt-2 text-center sm:opacity-0 group-hover:opacity-100 transition-opacity w-11/12 sm:w-1/2">
          <p>{description}</p>
        </div>

        <button
          className="btn-primary absolute top-3/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
          onClick={handleUnlock}
        >
          Unlock Prompt
        </button>
      </div>
    </div >
  );
};

export default UnlockPrompt;

