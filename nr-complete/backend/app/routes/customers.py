from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user import User
from app.models.order import Order, OrderItem
from app.models.product import Product

customers_bp = Blueprint("customers", __name__)


# ──────────────────────────────────────────────────────────
# GET /api/customers/order-history
# Paginated order history for the logged-in customer.
# Used by: orders.html, profile.html (recent orders tab)
# ──────────────────────────────────────────────────────────
@customers_bp.route("/order-history", methods=["GET"])
@jwt_required()
def order_history():
    user_id  = int(get_jwt_identity())
    page     = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 10))
    status   = request.args.get("status")          # optional filter

    query = Order.query.filter_by(user_id=user_id)
    if status:
        query = query.filter_by(status=status)

    orders = query.order_by(Order.created_at.desc()) \
                  .paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "orders": [o.to_dict(include_items=True) for o in orders.items],
        "total":  orders.total,
        "pages":  orders.pages,
        "page":   orders.page,
    }), 200


# ──────────────────────────────────────────────────────────
# GET /api/customers/orders/<order_id>
# Single order detail for the logged-in customer.
# Ensures a customer can only view their own orders.
# ──────────────────────────────────────────────────────────
@customers_bp.route("/orders/<int:order_id>", methods=["GET"])
@jwt_required()
def get_order(order_id):
    user_id = int(get_jwt_identity())
    order   = Order.query.filter_by(id=order_id, user_id=user_id).first()

    if not order:
        return jsonify({"error": "Order not found"}), 404

    return jsonify(order.to_dict(include_items=True)), 200


# ──────────────────────────────────────────────────────────
# GET /api/customers/stats
# Summary stats for the customer's profile page.
# Returns: total orders, total spent, favourite product
# ──────────────────────────────────────────────────────────
@customers_bp.route("/stats", methods=["GET"])
@jwt_required()
def customer_stats():
    user_id = int(get_jwt_identity())

    orders = Order.query.filter_by(user_id=user_id).all()

    total_orders  = len(orders)
    total_spent   = sum(o.total_amount for o in orders)
    delivered     = sum(1 for o in orders if o.status == "delivered")
    pending       = sum(1 for o in orders if o.status in ("pending", "confirmed", "preparing", "out_for_delivery"))

    # Find most ordered product
    from sqlalchemy import func
    fav = (
        db.session.query(OrderItem.product_name, func.sum(OrderItem.quantity).label("qty"))
        .join(Order, Order.id == OrderItem.order_id)
        .filter(Order.user_id == user_id)
        .group_by(OrderItem.product_name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .first()
    )

    return jsonify({
        "total_orders":    total_orders,
        "total_spent":     round(total_spent, 2),
        "delivered_orders": delivered,
        "pending_orders":  pending,
        "favourite_product": fav[0] if fav else None,
    }), 200


# ──────────────────────────────────────────────────────────
# POST /api/customers/reorder/<order_id>
# Validates items from a past order are still available
# and returns them ready to re-add to cart.
# ──────────────────────────────────────────────────────────
@customers_bp.route("/reorder/<int:order_id>", methods=["POST"])
@jwt_required()
def reorder(order_id):
    user_id = int(get_jwt_identity())
    order   = Order.query.filter_by(id=order_id, user_id=user_id).first()

    if not order:
        return jsonify({"error": "Order not found"}), 404

    items_out   = []
    unavailable = []

    for item in order.items:
        product = Product.query.get(item.product_id)
        if product and product.is_available:
            items_out.append({
                "id":             product.id,
                "name":           product.name,
                "name_hi":        product.name_hi,
                "price_per_unit": product.price_per_unit,
                "unit":           product.unit,
                "image_url":      product.image_url,
                "qty":            item.quantity,
            })
        else:
            unavailable.append(item.product_name)

    return jsonify({
        "items":       items_out,
        "unavailable": unavailable,
        "message":     f"{len(unavailable)} item(s) are currently unavailable." if unavailable else "All items available!"
    }), 200


# ──────────────────────────────────────────────────────────
# GET /api/customers/profile
# Returns the full profile of the logged-in customer
# including addresses and recent order count.
# ──────────────────────────────────────────────────────────
@customers_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_profile():
    user_id = int(get_jwt_identity())
    user    = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    order_count = Order.query.filter_by(user_id=user_id).count()

    return jsonify({
        "user": {
            "id":         user.id,
            "name":       user.name,
            "email":      user.email,
            "phone":      user.phone,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
        "addresses":   [a.to_dict() for a in user.addresses],
        "order_count": order_count,
    }), 200
