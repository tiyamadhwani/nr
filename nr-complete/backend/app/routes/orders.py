from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db, socketio
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.user import User
from app.models.analytics import HourlySales, ProductDemand
from app.utils.email_utils import send_order_notification_to_admin, send_order_confirmation_to_customer
from datetime import datetime, date

orders_bp = Blueprint("orders", __name__)


def _is_admin():
    try:
        uid = int(get_jwt_identity())
        user = User.query.get(uid)
        return user and user.role == "admin"
    except Exception:
        return False


# ── Place order ──────────────────────────────────────────────────────────────

@orders_bp.route("/", methods=["POST"])
@jwt_required()
def place_order():
    user_id = int(get_jwt_identity())
    user    = User.query.get_or_404(user_id)
    data    = request.get_json()

    required_addr = ["delivery_name", "delivery_phone", "delivery_street",
                     "delivery_area", "delivery_pincode"]
    if not all(k in data for k in required_addr):
        return jsonify({"error": "Delivery address is incomplete"}), 400

    if not data.get("items"):
        return jsonify({"error": "No items in order"}), 400

    # Build order
    order = Order(
        user_id=user_id,
        delivery_name=data["delivery_name"],
        delivery_phone=data["delivery_phone"],
        delivery_street=data["delivery_street"],
        delivery_area=data["delivery_area"],
        delivery_city=data.get("delivery_city", "Udaipur"),
        delivery_state=data.get("delivery_state", "Rajasthan"),
        delivery_pincode=data["delivery_pincode"],
        payment_method=data.get("payment_method", "cod"),
        payment_ref=data.get("payment_ref"),
        notes=data.get("notes"),
    )

    subtotal = 0.0
    for item_data in data["items"]:
        product = Product.query.get(item_data["product_id"])
        if not product or not product.is_available:
            return jsonify({"error": f"Product {item_data['product_id']} not available"}), 400

        qty   = float(item_data["quantity"])
        price = product.price_per_unit
        total = round(qty * price, 2)

        order_item = OrderItem(
            product_id=product.id,
            product_name=product.name,
            unit=product.unit,
            quantity=qty,
            unit_price=price,
            total_price=total,
        )
        order.items.append(order_item)
        subtotal += total

        # Update stock
        product.stock_quantity = max(0, product.stock_quantity - qty)

    delivery_charge = 0.0 if subtotal >= 300 else 30.0
    order.subtotal       = round(subtotal, 2)
    order.delivery_charge= delivery_charge
    order.total_amount   = round(subtotal + delivery_charge, 2)
    order.status         = "pending"

    db.session.add(order)
    db.session.commit()

    # ── Analytics update ─────────────────────────────────────────
    _update_hourly_sales(order)
    _update_product_demand(order)

    # ── Notifications ────────────────────────────────────────────
    # Real-time socket to admin panel
    socketio.emit("new_order", {
        "order_number": order.order_number,
        "customer":     order.delivery_name,
        "total":        order.total_amount,
        "time":         datetime.utcnow().isoformat(),
    }, room="admins")

    # Email – run in background thread so it doesn't block the response
    import threading
    def _send_emails():
        try:
            send_order_notification_to_admin(order)
        except Exception as e:
            app.logger.error(f"Admin email failed: {e}")
        try:
            if user.email:
                send_order_confirmation_to_customer(order, user.email)
        except Exception as e:
            app.logger.error(f"Customer email failed: {e}")
    from flask import current_app as app
    threading.Thread(target=_send_emails, daemon=True).start()

    return jsonify({
        "message":      "Order placed successfully",
        "order_number": order.order_number,
        "order":        order.to_dict(include_items=True),
    }), 201


# ── Customer: view own orders ────────────────────────────────────────────────

@orders_bp.route("/my-orders", methods=["GET"])
@jwt_required()
def my_orders():
    user_id = int(get_jwt_identity())
    page    = int(request.args.get("page", 1))
    orders  = Order.query.filter_by(user_id=user_id)\
                  .order_by(Order.created_at.desc())\
                  .paginate(page=page, per_page=10, error_out=False)
    return jsonify({
        "orders": [o.to_dict(include_items=True) for o in orders.items],
        "total":  orders.total,
        "pages":  orders.pages,
    }), 200


@orders_bp.route("/<int:order_id>", methods=["GET"])
@jwt_required()
def get_order(order_id):
    user_id = int(get_jwt_identity())
    user    = User.query.get(user_id)
    order   = Order.query.get_or_404(order_id)
    if order.user_id != user_id and user.role != "admin":
        return jsonify({"error": "Unauthorized"}), 403
    return jsonify({"order": order.to_dict(include_items=True)}), 200


# ── Admin: all orders + status update ───────────────────────────────────────

@orders_bp.route("/admin/all", methods=["GET"])
@jwt_required()
def all_orders():
    if not _is_admin():
        return jsonify({"error": "Admin access required"}), 403

    status = request.args.get("status")
    page   = int(request.args.get("page", 1))
    query  = Order.query.order_by(Order.created_at.desc())
    if status:
        query = query.filter_by(status=status)

    orders = query.paginate(page=page, per_page=20, error_out=False)
    return jsonify({
        "orders": [o.to_dict(include_items=True) for o in orders.items],
        "total":  orders.total,
        "pages":  orders.pages,
    }), 200


@orders_bp.route("/admin/<int:order_id>/status", methods=["PUT"])
@jwt_required()
def update_order_status(order_id):
    if not _is_admin():
        return jsonify({"error": "Admin access required"}), 403

    order = Order.query.get_or_404(order_id)
    data  = request.get_json()
    valid_statuses = ["pending", "confirmed", "preparing",
                      "out_for_delivery", "delivered", "cancelled"]

    if data.get("status") not in valid_statuses:
        return jsonify({"error": "Invalid status"}), 400

    order.status = data["status"]
    if data["status"] == "delivered":
        order.delivered_at   = datetime.utcnow()
        order.payment_status = "paid" if order.payment_method != "cod" else order.payment_status

    db.session.commit()

    # Notify customer via socket
    socketio.emit(f"order_update_{order.user_id}", {
        "order_number": order.order_number,
        "status":       order.status,
    })

    return jsonify({"message": "Order status updated", "order": order.to_dict()}), 200


# ── Helpers ──────────────────────────────────────────────────────────────────

def _update_hourly_sales(order):
    today = date.today()
    hour  = datetime.utcnow().hour
    hs    = HourlySales.query.filter_by(date=today, hour=hour).first()
    if hs:
        hs.order_count += 1
        hs.revenue     += order.total_amount
    else:
        db.session.add(HourlySales(date=today, hour=hour,
                                   order_count=1, revenue=order.total_amount))
    db.session.commit()


def _update_product_demand(order):
    today = date.today()
    for item in order.items:
        pd = ProductDemand.query.filter_by(product_id=item.product_id, date=today).first()
        if pd:
            pd.quantity_sold += item.quantity
            pd.order_count   += 1
            pd.revenue       += item.total_price
        else:
            db.session.add(ProductDemand(
                product_id=item.product_id,
                product_name=item.product_name,
                date=today,
                quantity_sold=item.quantity,
                order_count=1,
                revenue=item.total_price,
            ))
    db.session.commit()