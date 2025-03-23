import { useState } from "react";
import { ethers } from "ethers";

const ConnectWallet = ({ onConnected }) => {
  const [account, setAccount] = useState(null);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setAccount(address);
        onConnected(address); // Pass wallet address to parent component
      } catch (error) {
        console.error("MetaMask connection error:", error);
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  return (
    <div>
      <button onClick={connectWallet} className="p-2 bg-blue-500 text-white rounded">
        {account ? `Connected: ${account.slice(0, 6)}...${account.slice(-4)}` : "Connect Wallet"}
      </button>
    </div>
  );
};

export default ConnectWallet;
