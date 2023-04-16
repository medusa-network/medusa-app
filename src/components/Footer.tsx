import TelegramIcon from './TelegramIcon';
import TwitterIcon from './TwitterIcon';

const Footer: React.FC = () => {
  return (
    <footer className="flex items-center justify-between py-4 px-6 bg-primary text-off-white w-full">
      <a href="https://twitter.com/your_twitter" target="_blank" rel="noreferrer">
        <TwitterIcon className="w-10 h-10" />
      </a>
      <p className="text-lg">You have 5 credits!</p>
      <a href="https://t.me/your_telegram" target="_blank" rel="noreferrer">
        <TelegramIcon className="w-10 h-10" />
      </a>
    </footer>
  );
};

export default Footer;
