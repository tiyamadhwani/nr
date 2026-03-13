from app import db
from datetime import datetime


class Product(db.Model):
    __tablename__ = "products"

    id              = db.Column(db.Integer, primary_key=True)
    name            = db.Column(db.String(100), nullable=False)
    name_hi         = db.Column(db.String(100))                      # Hindi name
    category        = db.Column(db.String(50), nullable=False)       # vegetable | fruit
    description     = db.Column(db.Text)
    price_per_unit  = db.Column(db.Float, nullable=False)
    unit            = db.Column(db.String(20), nullable=False)       # kg | bunch | piece | dozen
    stock_quantity  = db.Column(db.Float, default=0)
    min_order_qty   = db.Column(db.Float, default=0.25)              # minimum order
    is_available    = db.Column(db.Boolean, default=True)
    is_featured     = db.Column(db.Boolean, default=False)
    image_url       = db.Column(db.String(255))
    tags            = db.Column(db.String(255))                      # comma-separated SEO tags
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at      = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    order_items     = db.relationship("OrderItem", backref="product", lazy=True)

    def to_dict(self):
        return {
            "id":             self.id,
            "name":           self.name,
            "name_hi":        self.name_hi,
            "category":       self.category,
            "description":    self.description,
            "price_per_unit": self.price_per_unit,
            "unit":           self.unit,
            "stock_quantity": self.stock_quantity,
            "min_order_qty":  self.min_order_qty,
            "is_available":   self.is_available,
            "is_featured":    self.is_featured,
            "image_url":      self.image_url,
            "tags":           self.tags,
            "created_at":     self.created_at.isoformat(),
        }
