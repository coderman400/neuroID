from scipy.spatial.distance import cosine
import numpy as np

def compare_embeddings(embedding1, embedding2):
    """
    Compare two embeddings using cosine similarity.

    Args:
        embedding1 (np.ndarray): First embedding.
        embedding2 (np.ndarray): Second embedding.

    Returns:
        float: Cosine similarity between the two embeddings.
    """
    embedding1 = np.squeeze(embedding1)
    embedding2 = np.squeeze(embedding2)
    
    similarity = 1 - cosine(embedding1, embedding2)
    return similarity