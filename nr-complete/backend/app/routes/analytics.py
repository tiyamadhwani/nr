from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user import User
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.analytics import SearchLog, HourlySales, ProductDemand
from sqlalchemy import func, desc
from datetime import datetime, date, timedelta
import math

analytics_bp = Blueprint("analytics", __name__)


def _require_admin():
    uid  = int(get_jwt_identity())
    user = User.query.get(uid)
    return user and user.role == "admin"


# ── Dashboard summary ────────────────────────────────────────────────────────

@analytics_bp.route("/dashboard", methods=["GET"])
@jwt_required()
def dashboard():
    if not _require_admin():
        return jsonify({"error": "Admin access required"}), 403

    today     = date.today()
    yesterday = today - timedelta(days=1)

    today_orders     = Order.query.filter(func.date(Order.created_at) == today).all()
    yesterday_orders = Order.query.filter(func.date(Order.created_at) == yesterday).all()

    today_revenue     = sum(o.total_amount for o in today_orders)
    yesterday_revenue = sum(o.total_amount for o in yesterday_orders)
    revenue_change    = 0
    if yesterday_revenue > 0:
        revenue_change = round(((today_revenue - yesterday_revenue) / yesterday_revenue) * 100, 1)

    total_customers = User.query.filter_by(role="customer").count()
    pending_orders  = Order.query.filter_by(status="pending").count()
    active_orders   = Order.query.filter(
        Order.status.in_(["confirmed", "preparing", "out_for_delivery"])
    ).count()

    total_orders_ever = Order.query.filter(Order.status != "cancelled").count()
    total_revenue_ever = db.session.query(func.sum(Order.total_amount)).filter(
        Order.status != "cancelled"
    ).scalar() or 0

    return jsonify({
        # keys used by admin dashboard cards
        "total_orders":    len(today_orders),
        "today_sales":     round(today_revenue, 2),
        "revenue_change":  revenue_change,
        "pending_orders":  pending_orders,
        "active_orders":   active_orders,
        "total_customers": total_customers,
        # extras
        "all_time_orders":  total_orders_ever,
        "all_time_revenue": round(float(total_revenue_ever), 2),
    }), 200


# ── Daily sales ──────────────────────────────────────────────────────────────

@analytics_bp.route("/daily-sales", methods=["GET"])
@jwt_required()
def daily_sales():
    if not _require_admin():
        return jsonify({"error": "Admin access required"}), 403

    days  = int(request.args.get("days", 7))
    today = date.today()
    start = today - timedelta(days=days - 1)

    results = db.session.query(
        func.date(Order.created_at).label("date"),
        func.count(Order.id).label("order_count"),
        func.sum(Order.total_amount).label("revenue"),
    ).filter(
        func.date(Order.created_at) >= start,
        Order.status != "cancelled",
    ).group_by(func.date(Order.created_at)).all()

    # Fill every day even if no orders
    sales_map = {str(r.date): {"orders": r.order_count, "revenue": round(float(r.revenue or 0), 2)} for r in results}
    data = []
    for i in range(days):
        d = start + timedelta(days=i)
        ds = str(d)
        data.append({"date": ds, "orders": sales_map.get(ds, {}).get("orders", 0),
                     "revenue": sales_map.get(ds, {}).get("revenue", 0)})

    return jsonify({"daily_sales": data, "sales": data}), 200  # both keys for compat


# ── Peak hours ───────────────────────────────────────────────────────────────

@analytics_bp.route("/peak-hours", methods=["GET"])
@jwt_required()
def peak_hours():
    if not _require_admin():
        return jsonify({"error": "Admin access required"}), 403

    days  = int(request.args.get("days", 7))
    start = date.today() - timedelta(days=days)

    results = db.session.query(
        HourlySales.hour,
        func.sum(HourlySales.order_count).label("orders"),
        func.sum(HourlySales.revenue).label("revenue"),
    ).filter(HourlySales.date >= start)\
     .group_by(HourlySales.hour)\
     .order_by(HourlySales.hour).all()

    hours = [
        {"hour": r.hour, "label": f"{r.hour:02d}:00",
         "orders": int(r.orders or 0), "order_count": int(r.orders or 0),
         "revenue": round(float(r.revenue or 0), 2)}
        for r in results
    ]
    return jsonify({"peak_hours": hours}), 200


# ── Top products ─────────────────────────────────────────────────────────────

@analytics_bp.route("/product-demand", methods=["GET"])
@jwt_required()
def product_demand():
    if not _require_admin():
        return jsonify({"error": "Admin access required"}), 403

    days  = int(request.args.get("days", 7))
    limit = int(request.args.get("limit", 10))
    start = date.today() - timedelta(days=days)

    results = db.session.query(
        ProductDemand.product_name,
        func.sum(ProductDemand.quantity_sold).label("qty"),
        func.sum(ProductDemand.order_count).label("orders"),
        func.sum(ProductDemand.revenue).label("revenue"),
    ).filter(ProductDemand.date >= start)\
     .group_by(ProductDemand.product_name)\
     .order_by(desc("orders"))\
     .limit(limit).all()

    data = [
        {
            "product":        r.product_name,
            "product_name":   r.product_name,
            "quantity_sold":  round(float(r.qty or 0), 2),
            "total_quantity": round(float(r.qty or 0), 2),
            "orders":         int(r.orders or 0),
            "order_count":    int(r.orders or 0),
            "revenue":        round(float(r.revenue or 0), 2),
            "total_revenue":  round(float(r.revenue or 0), 2),
        }
        for r in results
    ]
    return jsonify({"product_demand": data}), 200


# ── Failed searches ───────────────────────────────────────────────────────────

@analytics_bp.route("/failed-searches", methods=["GET"])
@jwt_required()
def failed_searches():
    if not _require_admin():
        return jsonify({"error": "Admin access required"}), 403

    limit = int(request.args.get("limit", 30))
    rows = db.session.execute(
        db.text(
            "SELECT query, COUNT(*) as cnt FROM search_logs "
            "WHERE results_found=0 GROUP BY query ORDER BY cnt DESC LIMIT :limit"
        ), {"limit": limit}
    ).fetchall()
    data = [{"query": r[0], "count": r[1]} for r in rows]
    return jsonify({"failed_searches": data}), 200


# ── Prediction: next 7 days forecast ─────────────────────────────────────────

@analytics_bp.route("/prediction", methods=["GET"])
@jwt_required()
def prediction():
    if not _require_admin():
        return jsonify({"error": "Admin access required"}), 403

    # Get last 30 days of data
    today = date.today()
    start = today - timedelta(days=30)

    results = db.session.query(
        func.date(Order.created_at).label("date"),
        func.count(Order.id).label("order_count"),
        func.sum(Order.total_amount).label("revenue"),
    ).filter(
        func.date(Order.created_at) >= start,
        Order.status != "cancelled",
    ).group_by(func.date(Order.created_at)).all()

    sales_map = {str(r.date): {"orders": r.order_count, "revenue": float(r.revenue or 0)} for r in results}
    history = []
    for i in range(30):
        d = start + timedelta(days=i)
        ds = str(d)
        history.append(sales_map.get(ds, {"orders": 0, "revenue": 0.0}))

    orders_hist  = [h["orders"]  for h in history]
    revenue_hist = [h["revenue"] for h in history]

    # Simple linear regression + 7-day moving avg for forecast
    def linear_forecast(series, steps=7):
        n = len(series)
        if n == 0:
            return [0] * steps
        x_mean = (n - 1) / 2
        y_mean = sum(series) / n
        num = sum((i - x_mean) * (series[i] - y_mean) for i in range(n))
        den = sum((i - x_mean) ** 2 for i in range(n))
        slope = num / den if den else 0
        intercept = y_mean - slope * x_mean
        return [max(0, round(intercept + slope * (n + i), 1)) for i in range(steps)]

    orders_forecast  = linear_forecast(orders_hist)
    revenue_forecast = linear_forecast(revenue_hist)

    # Day-of-week multiplier (accounts for weekend peaks)
    dow_totals = [0.0] * 7
    dow_counts = [0]   * 7
    for i, h in enumerate(history):
        dow = (start + timedelta(days=i)).weekday()
        dow_totals[dow] += h["orders"]
        dow_counts[dow] += 1
    dow_avg = [dow_totals[d] / max(dow_counts[d], 1) for d in range(7)]
    overall_avg = sum(dow_avg) / 7 if sum(dow_avg) else 1

    forecast_days = []
    for i in range(7):
        fd = today + timedelta(days=i + 1)
        dow = fd.weekday()
        multiplier = (dow_avg[dow] / overall_avg) if overall_avg else 1
        multiplier = max(0.5, min(2.0, multiplier))
        forecast_days.append({
            "date":    str(fd),
            "weekday": fd.strftime("%a"),
            "orders":  round(orders_forecast[i] * multiplier, 1),
            "revenue": round(revenue_forecast[i] * multiplier, 1),
        })

    # Peak hour prediction
    hour_results = db.session.query(
        HourlySales.hour,
        func.sum(HourlySales.order_count).label("orders"),
    ).filter(HourlySales.date >= start)\
     .group_by(HourlySales.hour).all()
    hour_map = {r.hour: int(r.orders or 0) for r in hour_results}
    peak_hour = max(hour_map, key=hour_map.get) if hour_map else 10

    # Top predicted products (by recent velocity)
    top_products = db.session.query(
        ProductDemand.product_name,
        func.sum(ProductDemand.order_count).label("orders"),
    ).filter(ProductDemand.date >= today - timedelta(days=7))\
     .group_by(ProductDemand.product_name)\
     .order_by(desc("orders")).limit(5).all()

    return jsonify({
        "forecast": forecast_days,
        "peak_hour": peak_hour,
        "peak_hour_label": f"{peak_hour:02d}:00 – {(peak_hour+1):02d}:00",
        "top_predicted": [{"product": r.product_name, "orders": int(r.orders)} for r in top_products],
        "confidence": "medium" if len(results) >= 7 else "low",
        "data_points": len(results),
    }), 200