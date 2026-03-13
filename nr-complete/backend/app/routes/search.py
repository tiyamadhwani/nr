from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from app import db
from app.models.product import Product
from app.models.analytics import SearchLog
from sqlalchemy import or_

search_bp = Blueprint("search", __name__)


@search_bp.route("/", methods=["GET"])
def search_products():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify({"error": "Search query is required"}), 400

    # Try to get user_id if logged in (optional)
    user_id = None
    try:
        verify_jwt_in_request(optional=True)
        from flask_jwt_extended import get_jwt_identity
        uid = get_jwt_identity()
        if uid:
            user_id = int(uid)
    except Exception:
        pass

    results = Product.query.filter(
        or_(
            Product.name.ilike(f"%{q}%"),
            Product.name_hi.ilike(f"%{q}%"),
            Product.description.ilike(f"%{q}%"),
            Product.tags.ilike(f"%{q}%"),
            Product.category.ilike(f"%{q}%"),
        ),
        Product.is_available == True
    ).limit(20).all()

    found = len(results) > 0

    # Log the search
    log = SearchLog(
        user_id=user_id,
        query=q,
        results_found=found,
        result_count=len(results),
    )
    db.session.add(log)
    db.session.commit()

    return jsonify({
        "query":          q,
        "results_found":  found,
        "result_count":   len(results),
        "products":       [p.to_dict() for p in results],
    }), 200
