from PIL import Image
from fastapi import FastAPI, UploadFile, File
from fastapi import WebSocket, WebSocketDisconnect
from typing import List
from utils.extract_features import generate_mean_embedding, extract_embeddings
from utils.validate import compare_embeddings
from io import BytesIO
import numpy as np
from fastapi.middleware.cors import CORSMiddleware
import base64
import io
from facenet_pytorch import InceptionResnetV1, MTCNN

mtcnn = MTCNN(keep_all=False) 

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins. You can restrict it to specific domains if needed.
    allow_credentials=True,
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers
)



@app.post("/generate-mean-embedding/")
async def extract_features(files: List[UploadFile] = File(...)):
    """
    FastAPI endpoint to accept an array of image files, process them, and return the mean embedding.

    Args:
        files (List[UploadFile]): List of image files uploaded by the user.

    Returns:
        dict: Dictionary containing the mean embedding.
    """
    # Convert uploaded files to PIL Image objects
    image_array = [Image.open(BytesIO(await file.read())) for file in files]
    print(image_array)
    
    # Call the imported function to generate the mean embedding
    mean_embedding = generate_mean_embedding(image_array)
    print(mean_embedding)

    return {"mean_embedding": mean_embedding.tolist()}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint to receive image frames from the client, extract embeddings,
    and compare them with the saved embedding.
    """
    await websocket.accept()

    try:
        embedding2 = np.load("embeddings.npy")

        while True:
            # Receive base64-encoded image from the client
            data = await websocket.receive_text()
            image_bytes = base64.b64decode(data)
            
            # Convert bytes to PIL image
            image = Image.open(io.BytesIO(image_bytes))
            boxes, _ = mtcnn.detect(image)
            # Generate embedding from the received image
            embedding1 = extract_embeddings(image,boxes[0]).detach().cpu().numpy().flatten()

            # Compare the extracted embedding with the saved embedding
            similarity = compare_embeddings(embedding1, embedding2)

            # Stream similarity score back to the client
            await websocket.send_text(f"Similarity Score: {similarity:.4f}")

    except WebSocketDisconnect:
        print("Client disconnected from the WebSocket")

    except Exception as e:
        print(f"Error: {e}")
        await websocket.close()
