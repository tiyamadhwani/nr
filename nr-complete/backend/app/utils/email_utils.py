from flask_mail import Message
from app import mail
from flask import current_app
import os


def send_order_notification_to_admin(order):
    """Send instant email to admin when a new order is placed."""
    admin_email = os.getenv("ADMIN_EMAIL", "dextergrowth@gmail.com")
    subject = f"New Order Placed - {order.order_number} | NR Sabji Mandi"

    items_html = "".join(
        f"<tr><td>{item.product_name}</td><td>{item.quantity} {item.unit}</td>"
        f"<td>Rs.{item.unit_price}</td><td>Rs.{item.total_price}</td></tr>"
        for item in order.items
    )

    body = f"""
    <html><body style="font-family:Arial,sans-serif;color:#333;">
    <div style="max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
      <div style="background:#2e7d32;padding:20px;text-align:center;">
        <h2 style="color:#fff;margin:0;">NR Sabji Mandi - New Order</h2>
      </div>
      <div style="padding:20px;">
        <h3>Order Details</h3>
        <p><b>Order Number:</b> {order.order_number}</p>
        <p><b>Customer:</b> {order.delivery_name}</p>
        <p><b>Phone:</b> {order.delivery_phone}</p>
        <p><b>Address:</b> {order.delivery_street}, {order.delivery_area}, 
           {order.delivery_city} - {order.delivery_pincode}</p>
        <p><b>Payment:</b> {order.payment_method.upper()}</p>

        <h3>Items Ordered</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr style="background:#f5f5f5;">
            <th style="padding:8px;text-align:left;border:1px solid #ddd;">Product</th>
            <th style="padding:8px;text-align:left;border:1px solid #ddd;">Qty</th>
            <th style="padding:8px;text-align:left;border:1px solid #ddd;">Price</th>
            <th style="padding:8px;text-align:left;border:1px solid #ddd;">Total</th>
          </tr>
          {items_html}
        </table>

        <div style="margin-top:15px;border-top:2px solid #2e7d32;padding-top:10px;">
          <p><b>Subtotal:</b> Rs.{order.subtotal}</p>
          <p><b>Delivery Charge:</b> Rs.{order.delivery_charge}</p>
          <p style="font-size:18px;color:#2e7d32;"><b>Total: Rs.{order.total_amount}</b></p>
        </div>
      </div>
      <div style="background:#f5f5f5;padding:10px;text-align:center;font-size:12px;color:#666;">
        NR Sabji Mandi - Fresh Fruits and Vegetables | Udaipur, Rajasthan
      </div>
    </div>
    </body></html>
    """

    try:
        msg = Message(subject=subject, recipients=[admin_email], html=body)
        mail.send(msg)
        return True
    except Exception as e:
        current_app.logger.error(f"Failed to send admin email: {e}")
        return False


def send_order_confirmation_to_customer(order, customer_email):
    """Send order confirmation email to customer."""
    subject = f"Order Confirmed - {order.order_number} | NR Sabji Mandi"

    items_html = "".join(
        f"<tr><td style='padding:8px;border:1px solid #ddd;'>{item.product_name}</td>"
        f"<td style='padding:8px;border:1px solid #ddd;'>{item.quantity} {item.unit}</td>"
        f"<td style='padding:8px;border:1px solid #ddd;'>Rs.{item.total_price}</td></tr>"
        for item in order.items
    )

    body = f"""
    <html><body style="font-family:Arial,sans-serif;color:#333;">
    <div style="max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
      <div style="background:#2e7d32;padding:20px;text-align:center;">
        <h2 style="color:#fff;margin:0;">Order Confirmed!</h2>
        <p style="color:#c8e6c9;margin:5px 0;">NR Sabji Mandi</p>
      </div>
      <div style="padding:20px;">
        <p>Dear {order.delivery_name},</p>
        <p>Your order has been placed successfully. We will deliver fresh vegetables 
           and fruits to your doorstep soon!</p>
        <p><b>Order Number:</b> {order.order_number}</p>
        <table style="width:100%;border-collapse:collapse;margin:10px 0;">
          <tr style="background:#f5f5f5;">
            <th style="padding:8px;text-align:left;border:1px solid #ddd;">Item</th>
            <th style="padding:8px;text-align:left;border:1px solid #ddd;">Qty</th>
            <th style="padding:8px;text-align:left;border:1px solid #ddd;">Price</th>
          </tr>
          {items_html}
        </table>
        <p style="font-size:18px;color:#2e7d32;"><b>Total: Rs.{order.total_amount}</b></p>
        <p><b>Payment:</b> {order.payment_method.upper()}</p>
        <p>Thank you for shopping with NR Sabji Mandi!</p>
      </div>
    </div>
    </body></html>
    """

    try:
        msg = Message(subject=subject, recipients=[customer_email], html=body)
        mail.send(msg)
        return True
    except Exception as e:
        current_app.logger.error(f"Failed to send customer email: {e}")
        return False
