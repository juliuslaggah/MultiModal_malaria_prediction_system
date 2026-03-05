import logging
import sys
import io
from PIL import Image

# ==============================================================================
# THESIS SECTION 4.2.1: Auditability and Traceability
# This utility handles the centralized logging required for clinical governance.
# ==============================================================================

def setup_logger(name: str = "MalariaSystem"):
    """
    Configures a logger that outputs to both Console (for debugging)
    and a File (for permanent audit trails).
    """
    logger = logging.getLogger(name)
    
    # Check if handlers are already set to avoid duplicate logs
    if not logger.handlers:
        logger.setLevel(logging.INFO)

        # 1. Console Handler (Standard Output)
        c_handler = logging.StreamHandler(sys.stdout)
        c_format = logging.Formatter('%(asctime)s - %(levelname)s - %(module)s - %(message)s')
        c_handler.setFormatter(c_format)
        logger.addHandler(c_handler)

        # 2. File Handler (Persistent Log for Audit)
        # In a real deployment, this path might be a mounted volume
        f_handler = logging.FileHandler('system_audit.log')
        f_format = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
        f_handler.setFormatter(f_format)
        logger.addHandler(f_handler)

    return logger

# ==============================================================================
# THESIS SECTION 4.2.2: System Constraints & Reliability
# Basic validation helpers to prevent the system from crashing on bad data.
# ==============================================================================

def validate_image_bytes(file_bytes: bytes) -> bool:
    """
    Verifies that the uploaded bytes correspond to a valid image format.
    This prevents the heavy ML models from wasting resources on corrupted files.
    """
    try:
        image = Image.open(io.BytesIO(file_bytes))
        image.verify()  # Check for integrity
        return True
    except Exception:
        return False
