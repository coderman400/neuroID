import { useState } from 'react'
import './App.css'
import FaceCapture from './components/FaceCapture'
import { ethers } from "ethers";
import ConnectWallet from './components/ConnectWallet';

const provider = new ethers.JsonRpcProvider("http://localhost:8545");

const handleConnected = (address) => {
  console.log(address)
}

(async () => {
  const blockNumber = await provider.getBlockNumber();
  console.log("Current Block:", blockNumber);
})();

function App() {

  return (
    <>
      <div className='min-h-screen bg-black text-white'>
        <h2 className='text-3xl'> SKIBIDI BLOCKCHAIN</h2>
        <ConnectWallet onConnected={handleConnected}/>
        <FaceCapture />
      </div>
    </>
  )
}

export default App
