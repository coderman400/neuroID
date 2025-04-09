import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { ethers } from "ethers";
import bs58 from 'bs58'

const FaceCapture = ({ 
  onImagesCaptured,  // For login flow
  onHashReceived,    // For registration flow
  walletAddress, 
  captureButtonText = "Start Capture" 
}) => {
  const [images, setImages] = useState([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const processedRef = useRef(false);
  const [captureProgress, setCaptureProgress] = useState(0);

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

  // Handle completing capture when we have 10 images
  useEffect(() => {
    setCaptureProgress(Math.min((images.length / 10) * 100, 100));
    if (images.length >= 10 && !processedRef.current) {
      processedRef.current = true;
      clearInterval(intervalRef.current);
      setIsCapturing(false);
      
      const finalImages = images.slice(0, 10);
      
      if (onImagesCaptured) {
        // For login flow: pass images directly
        onImagesCaptured(finalImages);
      } else if (onHashReceived) {
        // For registration flow: process through backend
        sendToBackend(finalImages);
      }
    }
  }, [images, onImagesCaptured, onHashReceived]);

  // Image capture handler
  const captureImage = () => {
    if (!canvasRef.current || !videoRef.current) return;
    
    const ctx = canvasRef.current.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0, 320, 240);
    const imgData = canvasRef.current.toDataURL("image/jpeg");
    
    setImages(prev => {
      const newImages = [...prev, imgData];
      return newImages.length <= 10 ? newImages : prev;
    });
    
  };

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

      const response = await axios.post("http://172.20.10.7:8000/register", formData, {
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
    setCaptureProgress(0)
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setImages([]);
    setIsCapturing(true);
    processedRef.current = false;
    intervalRef.current = setInterval(captureImage, 500);
  };


  return (
    <div className="flex flex-col items-center">
      <video ref={videoRef} autoPlay playsInline width={320} height={240} className="rounded-lg" />
      <canvas ref={canvasRef} width={320} height={240} hidden />
      <button 
        onClick={startCapturing} 
        className="mt-2 px-6 py-2 bg-[#252422] hover:bg-gray-900 text-white rounded-full transition-colors duration-200"
        disabled={isCapturing}
      >
        {isCapturing ? (
          <span className="flex items-center">
            <span className="animate-pulse mr-2">⏳</span>
            Capturing...
          </span>
        ) : (
          captureButtonText
        )}
      </button>
      {/* Progress bar */}
      <div className="w-full max-w-xs bg-gray-700 rounded-full h-2.5 mt-4 mb-4">
        <div 
          className="bg-[#eb5e28] h-2.5 rounded-full transition-all duration-300 ease-out" 
          style={{ width: `${captureProgress}%` }}
        ></div>
      </div>
      
      {/* <div className="flex mt-4 space-x-2 overflow-x-auto">
        {images.map((img, i) => (
          <img key={i} src={img} alt={`Frame ${i+1}`} className="w-16 h-16 object-cover rounded-lg border" />
        ))}
      </div> */}
    </div>
  );
};

export default FaceCapture;