# ═══════════════════════════════════════════════════════════
# NR SABJI MANDI — WhatsApp Notifications
# app/utils/whatsapp.py
#
# Supports TWO providers — use whichever you have:
#   1. WATI (Indian-friendly, WhatsApp Business API)
#   2. Twilio WhatsApp Sandbox (easy testing)
#
# Set WHATSAPP_PROVIDER=wati or twilio in .env
# ═══════════════════════════════════════════════════════════

import os
import requests
import logging
from string import Template

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────
# MESSAGE TEMPLATES
# ──────────────────────────────────────────────────────────

TEMPLATES = {
    "order_placed_customer": Template("""
*NR Sabji Mandi* 🌿
Namaste $customer_name!

Your order has been placed successfully.

*Order:* $order_number
*Items:* $items_summary
*Total:* ₹$total_amount
*Payment:* $payment_method
*Delivery to:* $delivery_area

We will deliver your fresh sabzi within 30–60 minutes.
Track your order: $track_url

धन्यवाद! Thank you for ordering from us.
    """.strip()),

    "order_status_update": Template("""
*NR Sabji Mandi* 🌿
Order Update for $customer_name

*Order:* $order_number
*Status:* $status_emoji $status_label

$status_message

For help, reply to this message.
    """.strip()),

    "order_delivered": Template("""
*NR Sabji Mandi* 🌿
Your order has been delivered! ✅

*Order:* $order_number
*Amount:* ₹$total_amount

We hope you enjoy your fresh vegetables and fruits!
Please rate your experience and order again soon.

आपकी सेवा में सदा तत्पर — NR Sabji Mandi
    """.strip()),

    "order_placed_admin": Template("""
🔔 *New Order Received!*

*Order:* $order_number
*Customer:* $customer_name
*Phone:* $customer_phone
*Items:* $items_summary
*Total:* ₹$total_amount
*Payment:* $payment_method
*Address:* $delivery_address

⏰ Placed at: $placed_time
    """.strip()),
}

STATUS_MESSAGES = {
    "confirmed":        ("✅", "Confirmed",        "Your order has been confirmed and will be prepared shortly."),
    "preparing":        ("👨‍🍳", "Being Prepared",   "Our team is carefully packing your fresh vegetables and fruits."),
    "out_for_delivery": ("🚚", "Out for Delivery", "Your order is on the way! Please be available to receive it."),
    "delivered":        ("🎉", "Delivered",         "Your order has been delivered. Enjoy your fresh produce!"),
    "cancelled":        ("❌", "Cancelled",         "Your order has been cancelled. Contact us if this was a mistake."),
}


# ──────────────────────────────────────────────────────────
# WATI PROVIDER
# ──────────────────────────────────────────────────────────

class WATIProvider:
    """
    WATI — WhatsApp Business API (popular in India)
    Sign up: https://www.wati.io
    Free trial available.

    .env keys:
        WATI_API_URL=https://live-mt-server.wati.io/YOUR_ACCOUNT_ID
        WATI_API_TOKEN=your_wati_bearer_token
        WATI_ADMIN_PHONE=919XXXXXXXXX   (country code + number, no +)
    """

    def __init__(self):
        self.api_url   = os.getenv("WATI_API_URL", "").rstrip("/")
        self.api_token = os.getenv("WATI_API_TOKEN", "")
        self.admin_phone = os.getenv("WATI_ADMIN_PHONE", "")

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type":  "application/json",
        }

    def send_text(self, phone: str, message: str) -> bool:
        """Send a plain text WhatsApp message via WATI."""
        if not self.api_url or not self.api_token:
            logger.warning("[WATI] Not configured. Skipping WhatsApp message.")
            return False

        # Normalise phone: remove +, spaces, dashes; ensure 91 prefix for India
        phone = phone.replace("+", "").replace(" ", "").replace("-", "")
        if len(phone) == 10:
            phone = "91" + phone

        url  = f"{self.api_url}/api/v1/sendSessionMessage/{phone}"
        body = {"messageText": message}

        try:
            r = requests.post(url, json=body, headers=self._headers(), timeout=8)
            r.raise_for_status()
            logger.info(f"[WATI] Message sent to {phone}")
            return True
        except requests.RequestException as e:
            logger.error(f"[WATI] Failed to send to {phone}: {e}")
            return False

    def send_template(self, phone: str, template_name: str, params: list) -> bool:
        """Send a pre-approved WATI template message."""
        phone = phone.replace("+", "").replace(" ", "").replace("-", "")
        if len(phone) == 10:
            phone = "91" + phone

        url  = f"{self.api_url}/api/v1/sendTemplateMessage"
        body = {
            "template_name": template_name,
            "broadcast_name": "order_notification",
            "receivers": [
                {
                    "whatsappNumber": phone,
                    "customParams": [{"name": f"p{i+1}", "value": str(v)} for i, v in enumerate(params)]
                }
            ]
        }

        try:
            r = requests.post(url, json=body, headers=self._headers(), timeout=8)
            r.raise_for_status()
            return True
        except requests.RequestException as e:
            logger.error(f"[WATI] Template send failed: {e}")
            return False


# ──────────────────────────────────────────────────────────
# TWILIO PROVIDER
# ──────────────────────────────────────────────────────────

class TwilioProvider:
    """
    Twilio WhatsApp Sandbox (great for testing, easy setup)
    Sign up: https://console.twilio.com
    Enable WhatsApp Sandbox in Twilio Console → Messaging → Try it out → Send a WhatsApp message

    .env keys:
        TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
        TWILIO_AUTH_TOKEN=your_auth_token
        TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   (Twilio sandbox number)
        WATI_ADMIN_PHONE=919XXXXXXXXX
    """

    def __init__(self):
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
        self.auth_token  = os.getenv("TWILIO_AUTH_TOKEN", "")
        self.from_number = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
        self.admin_phone = os.getenv("WATI_ADMIN_PHONE", "")

    def send_text(self, phone: str, message: str) -> bool:
        if not self.account_sid or not self.auth_token:
            logger.warning("[Twilio] Not configured. Skipping WhatsApp message.")
            return False

        # Normalise
        phone = phone.replace("+", "").replace(" ", "").replace("-", "")
        if len(phone) == 10:
            phone = "91" + phone
        to = f"whatsapp:+{phone}"

        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"
        data = {
            "From": self.from_number,
            "To":   to,
            "Body": message,
        }

        try:
            r = requests.post(url, data=data, auth=(self.account_sid, self.auth_token), timeout=8)
            r.raise_for_status()
            logger.info(f"[Twilio] WhatsApp sent to {phone}")
            return True
        except requests.RequestException as e:
            logger.error(f"[Twilio] Failed to send to {phone}: {e}")
            return False


# ──────────────────────────────────────────────────────────
# UNIFIED WHATSAPP SERVICE
# ──────────────────────────────────────────────────────────

class WhatsAppService:
    """
    Auto-selects provider based on WHATSAPP_PROVIDER env variable.
    Usage:
        from app.utils.whatsapp import whatsapp
        whatsapp.order_placed(order, customer)
    """

    def __init__(self):
        provider = os.getenv("WHATSAPP_PROVIDER", "wati").lower()
        self._provider = TwilioProvider() if provider == "twilio" else WATIProvider()
        self._enabled  = os.getenv("WHATSAPP_ENABLED", "true").lower() == "true"

    def _send(self, phone: str, message: str) -> bool:
        if not self._enabled:
            logger.info(f"[WhatsApp] Disabled. Would have sent to {phone}")
            return False
        return self._provider.send_text(phone, message)

    def _admin_phone(self):
        return os.getenv("WATI_ADMIN_PHONE", "")

    # ── Public methods ─────────────────────────────────────

    def order_placed_customer(self, order, customer) -> bool:
        """Notify customer that their order was received."""
        items_summary = self._items_summary(order)
        msg = TEMPLATES["order_placed_customer"].substitute(
            customer_name  = customer.name,
            order_number   = order.order_number,
            items_summary  = items_summary,
            total_amount   = f"{order.total_amount:.0f}",
            payment_method = order.payment_method.upper(),
            delivery_area  = order.delivery_area or order.delivery_city,
            track_url      = f"https://nrsabjimandi.com/orders.html",
        )
        return self._send(customer.phone, msg)

    def order_placed_admin(self, order, customer) -> bool:
        """Notify admin/owner about new order."""
        admin_phone = self._admin_phone()
        if not admin_phone:
            logger.warning("[WhatsApp] WATI_ADMIN_PHONE not set. Skipping admin notification.")
            return False

        from datetime import datetime
        items_summary = self._items_summary(order)
        msg = TEMPLATES["order_placed_admin"].substitute(
            order_number    = order.order_number,
            customer_name   = customer.name,
            customer_phone  = customer.phone,
            items_summary   = items_summary,
            total_amount    = f"{order.total_amount:.0f}",
            payment_method  = order.payment_method.upper(),
            delivery_address= f"{order.delivery_street}, {order.delivery_area}, {order.delivery_city}",
            placed_time     = datetime.now().strftime("%d %b %Y, %I:%M %p"),
        )
        return self._send(admin_phone, msg)

    def order_status_update(self, order, customer) -> bool:
        """Notify customer about status change."""
        s = STATUS_MESSAGES.get(order.status)
        if not s:
            return False
        emoji, label, msg_text = s

        if order.status == "delivered":
            msg = TEMPLATES["order_delivered"].substitute(
                customer_name = customer.name,
                order_number  = order.order_number,
                total_amount  = f"{order.total_amount:.0f}",
            )
        else:
            msg = TEMPLATES["order_status_update"].substitute(
                customer_name  = customer.name,
                order_number   = order.order_number,
                status_emoji   = emoji,
                status_label   = label,
                status_message = msg_text,
            )
        return self._send(customer.phone, msg)

    # ── Helper ─────────────────────────────────────────────

    @staticmethod
    def _items_summary(order) -> str:
        if not order.items:
            return "—"
        lines = [f"• {i.product_name} ({i.quantity}{i.unit})" for i in order.items[:5]]
        if len(order.items) > 5:
            lines.append(f"  ...and {len(order.items)-5} more")
        return "\n".join(lines)


# ── Singleton instance ──────────────────────────────────────
whatsapp = WhatsAppService()
