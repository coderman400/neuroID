import torch
import numpy as np
from PIL import Image
from facenet_pytorch import InceptionResnetV1, MTCNN

# Initialize the FaceNet model
model = InceptionResnetV1(pretrained="vggface2").eval()

# Initialize the MTCNN face detector
mtcnn = MTCNN(keep_all=False)  # keep_all=False to detect only one face

def extract_embeddings(image, box):
    """
    Extract facial embeddings from a cropped image using FaceNet.

    Args:
        image (PIL.Image): The original image object.
        box (tuple): Bounding box coordinates (x1, y1, x2, y2) for cropping.

    Returns:
        torch.Tensor: 512-dimensional facial embeddings.
    """
    # Crop the image to the detected face bounding box
    cropped_image = image.crop((int(box[0]), int(box[1]), int(box[2]), int(box[3])))

    # Resize to 160x160 as expected by the FaceNet model
    resized_image = cropped_image.resize((160, 160))

    # Normalize the image to [0, 1] and convert to tensor
    img_tensor = torch.tensor(np.array(resized_image).astype(np.float32) / 255.0).permute(2, 0, 1).unsqueeze(0)

    # Pass the image through the model to extract embeddings
    embeddings = model(img_tensor)

    return embeddings

def generate_mean_embedding(image_array):
    """
    Process an array of images, detect faces, extract embeddings, and compute the mean embedding.

    Args:
        image_array (list): List of PIL.Image objects to process.

    Returns:
        np.ndarray: The mean embedding after processing all images.
    """
    embeddings_list = []

    print(f"Processing {len(image_array)} images...")

    for idx, img in enumerate(image_array):
        print(f"Processing image {idx + 1}/{len(image_array)}...")
        
        # Detect faces in the image using MTCNN
        boxes, _ = mtcnn.detect(img)

        if boxes is not None:  # If a face is detected
            print(f"Face detected in image {idx + 1}")
            for box in boxes:
                # Extract embeddings for each detected face
                embeddings = extract_embeddings(img, box)
                embeddings_list.append(embeddings.detach().cpu().numpy())
        else:
            print(f"No face detected in image {idx + 1}")

    if len(embeddings_list) == 0:
        raise ValueError("No embeddings generated. Ensure faces are detected in the input images.")

    # Compute the mean of all captured embeddings
    mean_embedding = np.mean(embeddings_list, axis=0)
    np.save("embeddings.npy", mean_embedding)
    return mean_embedding


if __name__ == "__main__":
    # Example usage: Provide an array of PIL Images
    image_paths = ["image1.jpg", "image2.jpg", "image3.jpg"]  # Example file paths
    image_array = [Image.open(img_path) for img_path in image_paths]

    # Compute the mean embedding from the array of images
    mean_embedding = generate_mean_embedding(image_array)
    print("Mean Embedding:", mean_embedding)

    # Save the mean embedding to a file
    np.save("embeddings.npy", mean_embedding)