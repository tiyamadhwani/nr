from app import db
import bcrypt
from datetime import datetime


class User(db.Model):
    __tablename__ = "users"

    id            = db.Column(db.Integer, primary_key=True)
    name          = db.Column(db.String(100), nullable=False)
    email         = db.Column(db.String(150), unique=True, nullable=False)
    phone         = db.Column(db.String(15), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role          = db.Column(db.String(20), default="customer")   # customer | admin
    is_active     = db.Column(db.Boolean, default=True)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at    = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    orders        = db.relationship("Order", backref="customer", lazy=True)
    addresses     = db.relationship("Address", backref="user", lazy=True)

    def set_password(self, password: str):
        self.password_hash = bcrypt.hashpw(
            password.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")

    def check_password(self, password: str) -> bool:
        return bcrypt.checkpw(
            password.encode("utf-8"), self.password_hash.encode("utf-8")
        )

    def to_dict(self):
        return {
            "id":         self.id,
            "name":       self.name,
            "email":      self.email,
            "phone":      self.phone,
            "role":       self.role,
            "is_active":  self.is_active,
            "created_at": self.created_at.isoformat(),
        }


class Address(db.Model):
    __tablename__ = "addresses"

    id          = db.Column(db.Integer, primary_key=True)
    user_id     = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    label       = db.Column(db.String(50), default="Home")   # Home | Work | Other
    full_name   = db.Column(db.String(100), nullable=False)
    phone       = db.Column(db.String(15), nullable=False)
    street      = db.Column(db.String(255), nullable=False)
    area        = db.Column(db.String(100), nullable=False)
    city        = db.Column(db.String(100), default="Udaipur")
    state       = db.Column(db.String(100), default="Rajasthan")
    pincode     = db.Column(db.String(10), nullable=False)
    is_default  = db.Column(db.Boolean, default=False)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id":         self.id,
            "user_id":    self.user_id,
            "label":      self.label,
            "full_name":  self.full_name,
            "phone":      self.phone,
            "street":     self.street,
            "area":       self.area,
            "city":       self.city,
            "state":      self.state,
            "pincode":    self.pincode,
            "is_default": self.is_default,
        }
