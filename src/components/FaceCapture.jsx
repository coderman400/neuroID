import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { ethers } from "ethers";
import bs58 from 'bs58'



const FaceCapture = ({ 
  onImagesCaptured,  // For login flow
  onHashReceived,    // For registration flow
  walletAddress, 
  captureButtonText 
}) => {
  const [images, setImages] = useState([]);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  let flag = 0
  // Convert data URL to Blob
  const dataURLtoBlob = (dataURL) => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  // Webcam initialization and cleanup
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Error accessing webcam:", err);
      }
    };
    startCamera();
    return () => {
      // Cleanup on component unmount
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Image capture handler
  const captureImage = () => {
    if (!canvasRef.current || !videoRef.current) return;
    
    const ctx = canvasRef.current.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0, 320, 240);
    const imgData = canvasRef.current.toDataURL("image/jpeg");

    setImages(prev => {
      const newImages = [...prev, imgData];
      if (newImages.length >= 10) {
        clearInterval(intervalRef.current);
        if (onImagesCaptured) {
          // For login flow: pass images directly
          onImagesCaptured(newImages.slice(0, 10));
        } else if (onHashReceived) {
          // For registration flow: process through backend
          sendToBackend(newImages.slice(0, 10));
        }
      }
      return newImages.length <= 10 ? newImages : prev;
    });
  };

  // Send images to backend as multipart form
  // Send images to backend as multipart form
const sendToBackend = async (images) => {
  try {
    const formData = new FormData();
    
    // Add images as files
    images.forEach((img, index) => {
      const blob = dataURLtoBlob(img);
      formData.append('files', blob, `face_${index + 1}.jpg`);
    });
    
    // Add wallet address
    formData.append('wallet_address', walletAddress);

    const response = await axios.post("http://192.168.114.109:8000/register", formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    // Verify response structure
    if (!response.data?.ipfs_hash || typeof response.data.ipfs_hash !== 'string') {
      throw new Error('Invalid IPFS hash format from server');
    }

    // Decode base58 CID
    const decoded = bs58.decode(response.data.ipfs_hash);
    
    // Handle CIDv0 format (34 bytes: 2-byte prefix + 32-byte hash)
    if (decoded.length !== 34) {
      throw new Error(`Unexpected CID length: ${decoded.length} bytes (expected 34 for CIDv0)`);
    }
    
    // Extract the 32-byte hash (remove 2-byte prefix)
    const hashBytes = decoded.slice(2);
    
    // Validate hash length
    if (hashBytes.length !== 32) {
      throw new Error(`Invalid hash length: ${hashBytes.length} bytes (expected 32)`);
    }
    
    // Convert to Uint8Array for Ethereum compatibility
    const hashArray = new Uint8Array(hashBytes);
    onHashReceived(hashArray);

  } catch (error) {
    console.error("Face processing error:", error);
    // Add error state handling here if needed
  }
};


  // Start/stop capture
  const startCapturing = () => {
    // Clear any existing interval first
    flag=0
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setImages([]);
    intervalRef.current = setInterval(captureImage, 1000);
  };
  

  return (
    <div className="flex flex-col items-center">
      <video ref={videoRef} autoPlay playsInline width={320} height={240} className="border rounded-lg" />
      <canvas ref={canvasRef} width={320} height={240} hidden />
      <button onClick={startCapturing} className="mt-4 p-2 bg-blue-500 text-white rounded">
        Start Capture
      </button>
      <div className="flex mt-4 space-x-2 overflow-x-auto">
        {images.map((img, i) => (
          <img key={i} src={img} alt={`Frame ${i+1}`} className="w-16 h-16 object-cover rounded-lg border" />
        ))}
      </div>
    </div>
  );
};

export default FaceCapture;
