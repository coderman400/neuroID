import { useState } from 'react';
import './App.css';
import FaceCapture from './components/FaceCapture';
import { ethers } from 'ethers';
import ConnectWallet from './components/ConnectWallet';
import abi from '../build/contracts/BiometricIdentityManager.json';
import Login from './components/Login';
const CONTRACT_ADDRESS = "0x43B1CE1EF45A5506FC4D3b7E352cD39eDbb0DAc5";
const CONTRACT_ABI = abi.abi;

function App() {
  const [contract, setContract] = useState(null);
  const [connectedAddress, setConnectedAddress] = useState(null);

  // Handle wallet connection
  const handleConnected = async (signer) => {
    try {
      const address = await signer.getAddress();
      setConnectedAddress(address);
      
      const contractInstance = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );
      setContract(contractInstance);
      console.log("Contract initialized for:", address);
    } catch (error) {
      console.error("Connection error:", error);
    }
  };

  // Handle biometric hash registration
  const handleHashReceived = async (hashBytes) => {
    if (!contract) return;
    
    try {
      const tx = await contract.registerIdentity(hashBytes);
      console.log("Transaction sent:", tx.hash);
      await tx.wait();
      console.log("Identity registered successfully!");
    } catch (error) {
      console.error("Registration error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h2 className="text-3xl mb-8">SKIBIDI BLOCKCHAIN</h2>
      <ConnectWallet onConnected={handleConnected} />
      
      {connectedAddress && (
        <div className="mt-8">
          <FaceCapture 
            onHashReceived={handleHashReceived}
            walletAddress={connectedAddress}
          />
        </div>
      )}
      {contract && connectedAddress && (
        <Login contract={contract} walletAddress={connectedAddress} />
      )}
    </div>
  );
}

export default App;
