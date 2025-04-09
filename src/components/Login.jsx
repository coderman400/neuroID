import { useState } from 'react';
import { ethers } from 'ethers';
import bs58 from 'bs58';
import axios from 'axios';
import FaceCapture from './FaceCapture';

const Login = ({ contract, walletAddress, onLoginSuccess }) => {
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const bytes32ToCID = (hashBytes) => {
    // Make sure hashBytes is in the correct format
    try {
      const bytes = ethers.getBytes(hashBytes);
      const cidBytes = new Uint8Array(34);
      cidBytes.set([0x12, 0x20]); // CIDv0 prefix
      cidBytes.set(bytes, 2);
      return bs58.encode(cidBytes);
    } catch (error) {
      console.error("Error converting bytes32 to CID:", error);
      throw error;
    }
  };

  const handleLogin = async (images) => {
    try {
      setLoading(true);
      setVerificationStatus(null);
      let storedHash
      // 1. Get stored hash from blockchain
      try {
        storedHash = await contract.getBiometricHash(walletAddress);
      } catch (error) {
        // Check if this is the "Identity does not exist" error from the contract
        if (error.message && error.message.includes("Identity does not exist")) {
          console.log("User not registered yet");
          setVerificationStatus('not-registered');
          return;
        } else {
          // Some other unexpected error
          console.error("Unexpected error:", error);
          setVerificationStatus('error');
          return;
        }
      }
      
      console.log("Received hash from blockchain:", storedHash);
      
      // Handle empty hash scenario (user not registered)
      if (!storedHash || storedHash === "0x" || storedHash == "BAD_DATA" || storedHash === ethers.ZeroHash) {
        console.error("No biometric hash found for this address");
        setVerificationStatus('not-registered');
        return;
      }
      
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
        'http://172.20.10.7:8000/login',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      
      // 5. Blockchain verification
      if (response.data.authenticated) {
        console.log("Backend authentication successful");
        
        // Make sure we have valid bytes for the blockchain call
        const hashBytes = ethers.getBytes(storedHash);
        const tx = await contract.verifyIdentity(walletAddress, hashBytes);
        await tx.wait();
        setVerificationStatus('success');
        onLoginSuccess()
      } else {
        console.log("Backend authentication failed");
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
    <div className="p-6 ">
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
      {verificationStatus === 'not-registered' && (
        <div className="mt-4 p-3 bg-yellow-800 rounded">⚠ You need to register first</div>
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