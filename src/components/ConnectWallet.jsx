import { useState } from "react";
import { ethers } from "ethers";

const ConnectWallet = ({ onConnected }) => {
  const [account, setAccount] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const connectWallet = async () => {
    if (isConnecting) return;
    
    if (!window.ethereum) {
      alert("Please install MetaMask!");
      return;
    }

    setIsConnecting(true);
    setErrorMessage("");

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      
      if (accounts.length === 0) {
        throw new Error("No accounts found");
      }

      const signer = await provider.getSigner();
      const address = accounts[0];
      
      setAccount(address);
      onConnected(signer);
    } catch (error) {
      handleConnectionError(error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectionError = (error) => {
    if (error.code === -32002) {
      setErrorMessage("Complete connection in MetaMask first");
    } else if (error.code === 4001) {
      setErrorMessage("Connection rejected by user");
    } else {
      console.error("Connection error:", error);
      setErrorMessage("Failed to connect. Try again.");
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button 
        onClick={connectWallet} 
        disabled={isConnecting}
        className={`p-2 text-white rounded ${
          isConnecting ? 'bg-gray-500 cursor-not-allowed' : 'bg-[#252422] hover:bg-gray-900'
        }`}
      >
        {isConnecting ? "Connecting..." : 
         account ? `Connected: ${account.slice(0, 6)}...${account.slice(-4)}` : "Connect Wallet"}
      </button>
      
      {errorMessage && (
        <div className="text-red-500 text-sm max-w-xs text-center">
          {errorMessage}
          {errorMessage.includes("MetaMask") && (
            <div className="mt-1 text-xs">
              Check your MetaMask extension
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConnectWallet;
