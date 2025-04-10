import io
import os
import uuid
import time
import hashlib
import requests
import numpy as np
import cv2
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
from deepface import DeepFace
from mtcnn import MTCNN
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
from Crypto.Util.Padding import pad, unpad
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()
PINATA_JWT = os.getenv("PINATA_JWT")

LOG_FILE = "timing_logs.txt"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize MTCNN detector
detector = MTCNN()

def log_time(endpoint: str, duration: float):
    with open(LOG_FILE, "a") as f:
        f.write(f"{endpoint} - {duration:.4f} seconds\n")

def bytes_to_cv2_image(img_bytes: bytes):
    np_arr = np.frombuffer(img_bytes, np.uint8)
    return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

def preprocess_face(img):
    """
    Detect face using MTCNN, crop it, and convert to grayscale
    """
    # Detect faces
    faces = detector.detect_faces(img)
    if not faces:
        raise ValueError("No face detected")
    
    # Get the bounding box of the first face
    x, y, width, height = faces[0]['box']
    
    # Ensure coordinates are not negative
    x, y = max(0, x), max(0, y)
    
    # Crop the face
    face = img[y:y+height, x:x+width]
    
    # Convert to grayscale
    face_gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)
    
    # Convert back to BGR for compatibility with DeepFace
    face_bgr = cv2.cvtColor(face_gray, cv2.COLOR_GRAY2BGR)
    
    return face_bgr

def derive_key(wallet_address: str):
    return hashlib.sha256(wallet_address.encode()).digest()

def encrypt_data(data: bytes, key: bytes):
    iv = get_random_bytes(16)
    cipher = AES.new(key, AES.MODE_CBC, iv)
    encrypted = cipher.encrypt(pad(data, AES.block_size))
    return iv + encrypted

def decrypt_data(encrypted_data: bytes, key: bytes):
    iv = encrypted_data[:16]
    encrypted = encrypted_data[16:]
    cipher = AES.new(key, AES.MODE_CBC, iv)
    return unpad(cipher.decrypt(encrypted), AES.block_size)

def pin_to_ipfs(file_bytes: bytes, filename: str):
    url = "https://api.pinata.cloud/pinning/pinFileToIPFS"
    headers = {"Authorization": f"Bearer {PINATA_JWT}"}
    files = {
        'file': (filename, io.BytesIO(file_bytes))
    }
    response = requests.post(url, files=files, headers=headers)
    response.raise_for_status()
    return response.json()["IpfsHash"]

@app.post("/register")
async def register(wallet_address: str = Form(...), files: list[UploadFile] = File(...)):
    print("hit - register")
    start_time = time.time()

    embeddings = []
    for file in files:
        contents = await file.read()
        img = bytes_to_cv2_image(contents)
        
        try:
            # Preprocess the face - detect, crop, grayscale
            processed_face = preprocess_face(img)
            
            # Get embedding using ArcFace
            embedding = DeepFace.represent(processed_face, model_name="ArcFace", enforce_detection=True,detector_backend='retinaface')[0]["embedding"]
            embeddings.append(embedding)
        except Exception as e:
            print(f"⚠️ Error processing image: {file.filename} — {e}")

    if not embeddings:
        return JSONResponse(status_code=400, content={"error": "No valid images uploaded."})

    embeddings_array = np.array(embeddings)
    npz_bytes = io.BytesIO()
    np.save(npz_bytes, embeddings_array)

    encrypted_npz = encrypt_data(npz_bytes.getvalue(), derive_key(wallet_address))
    ipfs_hash = pin_to_ipfs(encrypted_npz, f"{wallet_address}_embeddings.npy")

    log_time("register", time.time() - start_time)
    return JSONResponse({"ipfs_hash": ipfs_hash})


@app.post("/login")
async def login(ipfs_hash: str = Form(...), wallet_address: str = Form(...), files: list[UploadFile] = File(...)):
    print("hit - register")
    start_time = time.time()

    url = f"https://gateway.pinata.cloud/ipfs/{ipfs_hash}"
    r = requests.get(url)
    r.raise_for_status()
    encrypted_npz = r.content
    decrypted_npz = decrypt_data(encrypted_npz, derive_key(wallet_address))
    stored_embeddings = np.load(io.BytesIO(decrypted_npz))
    threshold = 0.85

    for file in files:
        contents = await file.read()
        img = bytes_to_cv2_image(contents)

        try:
            # Apply the same preprocessing as during registration
            processed_face = preprocess_face(img)
            embedding = DeepFace.represent(processed_face, model_name="ArcFace", enforce_detection=True,detector_backend='retinaface')[0]["embedding"]
        except Exception as e:
            print(f"⚠️ Error processing image: {file.filename} — {e}")
            continue

        for stored in stored_embeddings:
            sim = np.dot(embedding, stored) / (np.linalg.norm(embedding) * np.linalg.norm(stored))
            print(sim)
            if sim >= threshold:
                log_time("login", time.time() - start_time)
                return JSONResponse({"authenticated": True})

    log_time("login", time.time() - start_time)
    return JSONResponse({"authenticated": False})