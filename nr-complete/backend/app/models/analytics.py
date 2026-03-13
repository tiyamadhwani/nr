from app import db
from datetime import datetime


class SearchLog(db.Model):
    """Tracks every customer search — found or not found."""
    __tablename__ = "search_logs"

    id           = db.Column(db.Integer, primary_key=True)
    user_id      = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    query        = db.Column(db.String(255), nullable=False)
    results_found= db.Column(db.Boolean, default=True)
    result_count = db.Column(db.Integer, default=0)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id":            self.id,
            "user_id":       self.user_id,
            "query":         self.query,
            "results_found": self.results_found,
            "result_count":  self.result_count,
            "created_at":    self.created_at.isoformat(),
        }


class DailySales(db.Model):
    """Aggregated daily sales snapshot (generated on-demand / cron)."""
    __tablename__ = "daily_sales"

    id             = db.Column(db.Integer, primary_key=True)
    date           = db.Column(db.Date, unique=True, nullable=False)
    total_orders   = db.Column(db.Integer, default=0)
    total_revenue  = db.Column(db.Float, default=0)
    avg_order_value= db.Column(db.Float, default=0)
    new_customers  = db.Column(db.Integer, default=0)
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "date":           self.date.isoformat(),
            "total_orders":   self.total_orders,
            "total_revenue":  self.total_revenue,
            "avg_order_value":self.avg_order_value,
            "new_customers":  self.new_customers,
        }


class HourlySales(db.Model):
    """Tracks orders per hour for peak-hour analytics."""
    __tablename__ = "hourly_sales"

    id          = db.Column(db.Integer, primary_key=True)
    date        = db.Column(db.Date, nullable=False)
    hour        = db.Column(db.Integer, nullable=False)   # 0-23
    order_count = db.Column(db.Integer, default=0)
    revenue     = db.Column(db.Float, default=0)

    def to_dict(self):
        return {
            "date":        self.date.isoformat(),
            "hour":        self.hour,
            "order_count": self.order_count,
            "revenue":     self.revenue,
        }


class ProductDemand(db.Model):
    """Tracks how many times each product was ordered."""
    __tablename__ = "product_demand"

    id           = db.Column(db.Integer, primary_key=True)
    product_id   = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    product_name = db.Column(db.String(100))
    date         = db.Column(db.Date, nullable=False)
    quantity_sold= db.Column(db.Float, default=0)
    order_count  = db.Column(db.Integer, default=0)
    revenue      = db.Column(db.Float, default=0)

    def to_dict(self):
        return {
            "product_id":    self.product_id,
            "product_name":  self.product_name,
            "date":          self.date.isoformat(),
            "quantity_sold": self.quantity_sold,
            "order_count":   self.order_count,
            "revenue":       self.revenue,
        }
