import { useState } from 'react';
import { ethers } from 'ethers';
import bs58 from 'bs58';
import axios from 'axios';
import FaceCapture from './FaceCapture';

const Login = ({ contract, walletAddress }) => {
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timing, setTiming] = useState({ total: 0, backend: 0, blockchain: 0 });

  const handleLogin = async (images, startTime) => {
    try {
      setLoading(true);
      setVerificationStatus(null);
      const timingData = { start: Date.now() };

      // Backend verification
      timingData.backendStart = Date.now();
      const formData = new FormData();
      images.forEach((img, index) => {
        const blob = dataURLtoBlob(img);
        formData.append('files', blob, `login_${index}.jpg`);
      });
      formData.append('wallet_address', walletAddress);
      
      const response = await axios.post(
        'http://192.168.114.109:8000/login', 
        formData, 
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      timingData.backend = Date.now() - timingData.backendStart;

      // Blockchain verification
      if (response.data.authenticated) {
        timingData.blockchainStart = Date.now();
        const storedHash = await contract.getBiometricHash(walletAddress);
        const tx = await contract.verifyIdentity(walletAddress, ethers.getBytes(storedHash));
        await tx.wait();
        timingData.blockchain = Date.now() - timingData.blockchainStart;
        
        setTiming({
          total: Date.now() - timingData.start,
          backend: timingData.backend,
          blockchain: timingData.blockchain
        });
        setVerificationStatus('success');
      } else {
        setVerificationStatus('invalid');
      }
    } catch (error) {
      console.error('Login error:', error);
      setVerificationStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-800 rounded-lg">
      <h3 className="text-xl mb-4">Biometric Login</h3>
      
      <FaceCapture 
        onImagesCaptured={handleLogin}
        walletAddress={walletAddress}
        captureButtonText={loading ? 'Verifying...' : 'Start Login'}
        onCaptureStart={(start) => setTiming({ start })}
      />

      {verificationStatus === 'success' && (
        <div className="mt-4 p-3 bg-green-800 rounded">
          ✓ Login successful!<br/>
          <span className="text-xs">
            Total: {timing.total}ms | Backend: {timing.backend}ms | Blockchain: {timing.blockchain}ms
          </span>
        </div>
      )}

      {/* Other status displays */}
    </div>
  );
};

// dataURLtoBlob function remains the same




const dataURLtoBlob = (dataURL) => {
  if (typeof dataURL !== 'string') {
    throw new Error('Invalid dataURL format');
  }
  
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  
  for (let i = 0; i < bstr.length; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  
  return new Blob([u8arr], { type: mime });
};

export default Login;
