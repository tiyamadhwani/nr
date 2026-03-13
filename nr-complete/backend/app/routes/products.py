from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.product import Product
from app.models.user import User

products_bp = Blueprint("products", __name__)


def _is_admin():
    try:
        uid = int(get_jwt_identity())
        user = User.query.get(uid)
        return user and user.role == "admin"
    except Exception:
        return False


# ── Public endpoints ────────────────────────────────────────────────────────

@products_bp.route("/", methods=["GET"])
def list_products():
    category  = request.args.get("category")
    featured  = request.args.get("featured")
    available = request.args.get("available", "true")
    page      = int(request.args.get("page", 1))
    per_page  = int(request.args.get("per_page", 20))

    query = Product.query
    if category:
        query = query.filter_by(category=category)
    if featured == "true":
        query = query.filter_by(is_featured=True)
    if available == "true":
        query = query.filter_by(is_available=True)

    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        "products":   [p.to_dict() for p in paginated.items],
        "total":      paginated.total,
        "page":       page,
        "pages":      paginated.pages,
    }), 200


@products_bp.route("/<int:product_id>", methods=["GET"])
def get_product(product_id):
    product = Product.query.get_or_404(product_id)
    return jsonify(product.to_dict()), 200


@products_bp.route("/categories", methods=["GET"])
def get_categories():
    categories = db.session.query(Product.category).distinct().all()
    return jsonify({"categories": [c[0] for c in categories]}), 200


# ── Admin CRUD ──────────────────────────────────────────────────────────────

@products_bp.route("/", methods=["POST"])
@jwt_required()
def create_product():
    if not _is_admin():
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json()
    required = ["name", "category", "price_per_unit", "unit"]
    if not all(k in data for k in required):
        return jsonify({"error": "Missing required fields"}), 400

    product = Product(
        name=data["name"],
        name_hi=data.get("name_hi"),
        category=data["category"],
        description=data.get("description"),
        price_per_unit=float(data["price_per_unit"]),
        unit=data["unit"],
        stock_quantity=float(data.get("stock_quantity", 0)),
        min_order_qty=float(data.get("min_order_qty", 0.25)),
        is_available=data.get("is_available", True),
        is_featured=data.get("is_featured", False),
        image_url=data.get("image_url"),
        tags=data.get("tags"),
    )
    db.session.add(product)
    db.session.commit()
    return jsonify({"message": "Product created", "product": product.to_dict()}), 201


@products_bp.route("/<int:product_id>", methods=["PUT"])
@jwt_required()
def update_product(product_id):
    if not _is_admin():
        return jsonify({"error": "Admin access required"}), 403

    product = Product.query.get_or_404(product_id)
    data = request.get_json()
    fields = ["name", "name_hi", "category", "description", "price_per_unit",
              "unit", "stock_quantity", "min_order_qty", "is_available",
              "is_featured", "image_url", "tags"]
    for f in fields:
        if f in data:
            setattr(product, f, data[f])
    db.session.commit()
    return jsonify({"message": "Product updated", "product": product.to_dict()}), 200


@products_bp.route("/<int:product_id>", methods=["DELETE"])
@jwt_required()
def delete_product(product_id):
    if not _is_admin():
        return jsonify({"error": "Admin access required"}), 403
    product = Product.query.get_or_404(product_id)
    db.session.delete(product)
    db.session.commit()
    return jsonify({"message": "Product deleted"}), 200
