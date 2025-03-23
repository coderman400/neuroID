import { useState, useRef, useEffect } from "react";

const FaceCapture = ({ onImagesCaptured }) => {
  const [images, setImages] = useState([]);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
      }
    };

    startCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const captureImage = () => {
    if (canvasRef.current && videoRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.drawImage(videoRef.current, 0, 0, 320, 240);
      const imgData = canvasRef.current.toDataURL("image/jpeg");
  
      setImages((prevImages) => {
        const newImages = [...prevImages, imgData];
  
        if (newImages.length >= 16) {
          clearInterval(intervalRef.current); // Stop capturing
        //   onImagesCaptured(newImages); // Send final images
        }
  
        return newImages; // Update state
      });
    }
  };
  

  const startCapturing = () => {
    setImages([]); // Reset images
    intervalRef.current = setInterval(captureImage, 1000); // Capture every second
  };

  return (
    <div className="flex flex-col items-center">
      <video ref={videoRef} autoPlay playsInline width={320} height={240} className="border rounded-lg" />
      <canvas ref={canvasRef} width={320} height={240} hidden />
      <button onClick={startCapturing} className="mt-4 p-2 bg-blue-500 text-white rounded">
        Start Capture
      </button>
      <div className="flex mt-4 space-x-2 overflow-x-auto">
        {images.map((img, index) => (
          <img key={index} src={img} alt={`Face ${index + 1}`} className="w-16 h-16 object-cover rounded-lg border" />
        ))}
      </div>
    </div>
  );
};

export default FaceCapture;
