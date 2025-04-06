import { useState } from 'react';
import { ethers } from 'ethers';
import bs58 from 'bs58';
import axios from 'axios';
import FaceCapture from './FaceCapture';

const Login = ({ contract, walletAddress }) => {
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const bytes32ToCID = (hashBytes) => {
    const cidBytes = new Uint8Array(34);
    cidBytes.set([0x12, 0x20]);
    cidBytes.set(ethers.getBytes(hashBytes), 2);
    return bs58.encode(cidBytes);
  };

  const handleLogin = async (images) => {
    try {
      setLoading(true);
      setVerificationStatus(null);

      // 1. Get stored hash from blockchain
      const storedHash = await contract.getBiometricHash(walletAddress);
      
      // 2. Convert to IPFS CID
      const storedCID = bytes32ToCID(storedHash);
      
      // 3. Prepare verification data
      const formData = new FormData();
      images.forEach((img, index) => {
        if (!img.startsWith('data:image')) {
          throw new Error(`Invalid image format at index ${index}`);
        }
        const blob = dataURLtoBlob(img);
        formData.append('files', blob, `login_${index}.jpg`);
      });
      formData.append('wallet_address', walletAddress);
      formData.append('ipfs_hash', storedCID);

      // 4. Verify with backend
      const response = await axios.post(
        'http://192.168.114.109:8000/login', 
        formData, 
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      // 5. Blockchain verification
      if (response.data.authenticated) {
        console.log("HI")
        const tx = await contract.verifyIdentity(walletAddress, ethers.getBytes(storedHash));
        await tx.wait();
        setVerificationStatus('success');
      } else {
        console.log("BYE")
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
      />

      {verificationStatus === 'success' && (
        <div className="mt-4 p-3 bg-green-800 rounded">✓ Login successful!</div>
      )}
      {verificationStatus === 'invalid' && (
        <div className="mt-4 p-3 bg-red-800 rounded">✗ Verification failed</div>
      )}
      {verificationStatus === 'error' && (
        <div className="mt-4 p-3 bg-red-800 rounded">⚠ Verification error</div>
      )}
    </div>
  );
};

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
