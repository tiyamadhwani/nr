from app import db
from datetime import datetime
import uuid


class Order(db.Model):
    __tablename__ = "orders"

    id               = db.Column(db.Integer, primary_key=True)
    order_number     = db.Column(db.String(20), unique=True, nullable=False,
                                 default=lambda: f"NR{uuid.uuid4().hex[:8].upper()}")
    user_id          = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    # Delivery address snapshot
    delivery_name    = db.Column(db.String(100), nullable=False)
    delivery_phone   = db.Column(db.String(15), nullable=False)
    delivery_street  = db.Column(db.String(255), nullable=False)
    delivery_area    = db.Column(db.String(100), nullable=False)
    delivery_city    = db.Column(db.String(100), default="Udaipur")
    delivery_state   = db.Column(db.String(100), default="Rajasthan")
    delivery_pincode = db.Column(db.String(10), nullable=False)

    # Pricing
    subtotal         = db.Column(db.Float, nullable=False, default=0)
    delivery_charge  = db.Column(db.Float, default=0)
    discount         = db.Column(db.Float, default=0)
    total_amount     = db.Column(db.Float, nullable=False, default=0)

    # Status
    status           = db.Column(db.String(30), default="pending")
    # pending | confirmed | preparing | out_for_delivery | delivered | cancelled

    # Payment
    payment_method   = db.Column(db.String(30), default="cod")   # cod | upi | card
    payment_status   = db.Column(db.String(20), default="unpaid") # unpaid | paid | refunded
    payment_ref      = db.Column(db.String(100))

    # Misc
    notes            = db.Column(db.Text)
    created_at       = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at       = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    delivered_at     = db.Column(db.DateTime)

    # Relationships
    items            = db.relationship("OrderItem", backref="order",
                                       lazy=True, cascade="all, delete-orphan")

    def to_dict(self, include_items=False):
        data = {
            "id":               self.id,
            "order_number":     self.order_number,
            "user_id":          self.user_id,
            "delivery_name":    self.delivery_name,
            "delivery_phone":   self.delivery_phone,
            "delivery_street":  self.delivery_street,
            "delivery_area":    self.delivery_area,
            "delivery_city":    self.delivery_city,
            "delivery_state":   self.delivery_state,
            "delivery_pincode": self.delivery_pincode,
            "subtotal":         self.subtotal,
            "delivery_charge":  self.delivery_charge,
            "discount":         self.discount,
            "total_amount":     self.total_amount,
            "status":           self.status,
            "payment_method":   self.payment_method,
            "payment_status":   self.payment_status,
            "payment_ref":      self.payment_ref,
            "notes":            self.notes,
            "created_at":       self.created_at.isoformat(),
            "updated_at":       self.updated_at.isoformat(),
            "delivered_at":     self.delivered_at.isoformat() if self.delivered_at else None,
        }
        if include_items:
            data["items"] = [item.to_dict() for item in self.items]
        return data


class OrderItem(db.Model):
    __tablename__ = "order_items"

    id          = db.Column(db.Integer, primary_key=True)
    order_id    = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=False)
    product_id  = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    product_name= db.Column(db.String(100))       # snapshot at time of order
    unit        = db.Column(db.String(20))
    quantity    = db.Column(db.Float, nullable=False)
    unit_price  = db.Column(db.Float, nullable=False)
    total_price = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            "id":           self.id,
            "order_id":     self.order_id,
            "product_id":   self.product_id,
            "product_name": self.product_name,
            "unit":         self.unit,
            "quantity":     self.quantity,
            "unit_price":   self.unit_price,
            "total_price":  self.total_price,
        }
