# ═══════════════════════════════════════════════════════════
# NR SABJI MANDI — Cloudinary Image Upload
# app/utils/cloudinary_upload.py
#
# Setup:
#   pip install cloudinary
#
# .env keys:
#   CLOUDINARY_CLOUD_NAME=your_cloud_name
#   CLOUDINARY_API_KEY=your_api_key
#   CLOUDINARY_API_SECRET=your_api_secret
#
# Sign up FREE at: https://cloudinary.com
# Free tier: 25GB storage, 25GB bandwidth/month — perfect for a sabzi shop!
# ═══════════════════════════════════════════════════════════

import os
import cloudinary
import cloudinary.uploader
import cloudinary.api
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required

upload_bp = Blueprint('upload', __name__)


def init_cloudinary():
    """Call this in your app factory (__init__.py) after creating the app."""
    cloudinary.config(
        cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key    = os.getenv("CLOUDINARY_API_KEY"),
        api_secret = os.getenv("CLOUDINARY_API_SECRET"),
        secure     = True,
    )


# ──────────────────────────────────────────────────────────
# UPLOAD ROUTE
# ──────────────────────────────────────────────────────────

@upload_bp.route('/upload/product-image', methods=['POST'])
@jwt_required()
def upload_product_image():
    """
    Accepts multipart/form-data with a file field named 'image'.
    Returns the Cloudinary URL to store in the product's image_url field.

    Frontend: POST /api/upload/product-image
              Content-Type: multipart/form-data
              Body: { image: File }
    Response: { url: "https://res.cloudinary.com/..." }
    """
    if 'image' not in request.files:
        return jsonify({'error': 'No image file provided'}), 400

    file = request.files['image']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400

    # Validate file type
    ALLOWED = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}
    if file.content_type not in ALLOWED:
        return jsonify({'error': 'Only JPEG, PNG, WebP or GIF allowed'}), 400

    # Max 5MB
    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > 5 * 1024 * 1024:
        return jsonify({'error': 'Image must be under 5MB'}), 400

    try:
        result = cloudinary.uploader.upload(
            file,
            folder          = "nr-sabji-mandi/products",
            transformation  = [
                {"width": 800, "height": 800, "crop": "fill", "gravity": "auto"},
                {"quality": "auto:good"},
                {"fetch_format": "auto"},
            ],
            resource_type   = "image",
        )
        return jsonify({
            'url':        result['secure_url'],
            'public_id':  result['public_id'],
            'width':      result['width'],
            'height':     result['height'],
        })
    except Exception as e:
        current_app.logger.error(f"Cloudinary upload error: {e}")
        return jsonify({'error': 'Upload failed. Please try again.'}), 500


@upload_bp.route('/upload/product-image/<public_id>', methods=['DELETE'])
@jwt_required()
def delete_product_image(public_id):
    """Delete an image from Cloudinary by public_id."""
    try:
        result = cloudinary.uploader.destroy(public_id)
        return jsonify({'deleted': result.get('result') == 'ok'})
    except Exception as e:
        current_app.logger.error(f"Cloudinary delete error: {e}")
        return jsonify({'error': 'Delete failed'}), 500
