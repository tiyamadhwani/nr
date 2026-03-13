from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt_identity
)
from app import db
from app.models.user import User, Address

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    required = ["name", "email", "phone", "password"]
    if not all(k in data for k in required):
        return jsonify({"error": "Missing required fields"}), 400

    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "Email already registered"}), 409

    user = User(
        name=data["name"],
        email=data["email"],
        phone=data["phone"],
        role="customer",
    )
    user.set_password(data["password"])
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify({
        "message": "Registration successful",
        "token": token,
        "user": user.to_dict()
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data.get("email")).first()

    if not user or not user.check_password(data.get("password", "")):
        return jsonify({"error": "Invalid email or password"}), 401

    if not user.is_active:
        return jsonify({"error": "Account is deactivated"}), 403

    token = create_access_token(identity=str(user.id))
    return jsonify({
        "message": "Login successful",
        "token": token,
        "user": user.to_dict()
    }), 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_profile():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    addresses = [a.to_dict() for a in user.addresses]
    return jsonify({"user": user.to_dict(), "addresses": addresses}), 200


@auth_bp.route("/me", methods=["PUT"])
@jwt_required()
def update_profile():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    if "name" in data:
        user.name = data["name"]
    if "phone" in data:
        user.phone = data["phone"]
    if "password" in data and data["password"]:
        user.set_password(data["password"])
    db.session.commit()
    return jsonify({"message": "Profile updated", "user": user.to_dict()}), 200


@auth_bp.route("/addresses", methods=["POST"])
@jwt_required()
def add_address():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    required = ["full_name", "phone", "street", "area", "pincode"]
    if not all(k in data for k in required):
        return jsonify({"error": "Missing address fields"}), 400

    if data.get("is_default"):
        Address.query.filter_by(user_id=user_id, is_default=True).update({"is_default": False})

    addr = Address(
        user_id=user_id,
        label=data.get("label", "Home"),
        full_name=data["full_name"],
        phone=data["phone"],
        street=data["street"],
        area=data["area"],
        city=data.get("city", "Udaipur"),
        state=data.get("state", "Rajasthan"),
        pincode=data["pincode"],
        is_default=data.get("is_default", False),
    )
    db.session.add(addr)
    db.session.commit()
    return jsonify({"message": "Address added", "address": addr.to_dict()}), 201


@auth_bp.route("/addresses/<int:addr_id>", methods=["DELETE"])
@jwt_required()
def delete_address(addr_id):
    user_id = int(get_jwt_identity())
    addr = Address.query.filter_by(id=addr_id, user_id=user_id).first_or_404()
    db.session.delete(addr)
    db.session.commit()
    return jsonify({"message": "Address deleted"}), 200
