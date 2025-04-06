import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { ethers } from "ethers";
import bs58 from 'bs58';

const FaceCapture = ({ 
  onImagesCaptured, 
  walletAddress, 
  captureButtonText,
  onCaptureStart,
  onRegistrationComplete 
}) => {
  const [images, setImages] = useState([]);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);

  // Data URL to Blob conversion with validation
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
      if (intervalRef.current) clearInterval(intervalRef.current);
      videoRef.current?.srcObject?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const captureImage = () => {
    if (!canvasRef.current || !videoRef.current) return;
    
    const ctx = canvasRef.current.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0, 320, 240);
    const imgData = canvasRef.current.toDataURL("image/jpeg");

    setImages(prev => {
      const newImages = [...prev, imgData];
      if (newImages.length >= 10) {
        clearInterval(intervalRef.current);
        sendToBackend(newImages.slice(0, 10));
      }
      return newImages.length <= 10 ? newImages : prev;
    });
  };

  const sendToBackend = async (images) => {
    const startTime = Date.now();
    try {
      const formData = new FormData();
      images.forEach((img, index) => {
        const blob = dataURLtoBlob(img);
        formData.append('files', blob, `face_${index + 1}.jpg`);
      });
      formData.append('wallet_address', walletAddress);

      // Backend processing
      const backendStart = Date.now();
      const response = await axios.post("http://192.168.114.109:8000/register", formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const backendTime = Date.now() - backendStart;

      // Hash processing
      const decoded = bs58.decode(response.data.ipfs_hash);
      const hashBytes = decoded.slice(2);
      const hashArray = new Uint8Array(hashBytes);

      // Blockchain registration
      const blockchainStart = Date.now();
      onRegistrationComplete(hashArray, {
        backendTime,
        totalTime: Date.now() - startTime
      });

    } catch (error) {
      console.error("Face processing error:", error);
    }
  };

  const startCapturing = () => {
    const startTime = Date.now();
    if (intervalRef.current) clearInterval(intervalRef.current);
    setImages([]);
    intervalRef.current = setInterval(captureImage, 1000);
    if (onCaptureStart) onCaptureStart(startTime);
  };

  return (
    <div className="flex flex-col items-center">
      <video ref={videoRef} autoPlay playsInline width={320} height={240} className="border rounded-lg" />
      <canvas ref={canvasRef} width={320} height={240} hidden />
      <button 
        onClick={startCapturing} 
        className="mt-4 p-2 bg-blue-500 text-white rounded"
        disabled={!walletAddress}
      >
        {captureButtonText || 'Start Capture'}
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
