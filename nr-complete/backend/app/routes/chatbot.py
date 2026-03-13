from flask import Blueprint, request, jsonify
from app.models.product import Product
from sqlalchemy import or_
import re

chatbot_bp = Blueprint("chatbot", __name__)

# ── NLTK setup (download once) ───────────────────────────────────────────────
import nltk
import os

nltk_data_path = os.path.join(os.path.dirname(__file__), "..", "..", "nltk_data")
os.makedirs(nltk_data_path, exist_ok=True)
nltk.data.path.append(nltk_data_path)

for pkg in ["punkt", "punkt_tab", "stopwords", "wordnet"]:
    try:
        nltk.data.find(f"tokenizers/{pkg}" if pkg in ("punkt", "punkt_tab") else f"corpora/{pkg}")
    except (LookupError, OSError):
        try:
            nltk.download(pkg, download_dir=nltk_data_path, quiet=True)
        except Exception:
            pass

try:
    from nltk.tokenize import word_tokenize
    from nltk.corpus import stopwords as _sw
    from nltk.stem import WordNetLemmatizer
    lemmatizer = WordNetLemmatizer()
    ENGLISH_STOPWORDS = set(_sw.words("english"))
except Exception:
    lemmatizer = None
    ENGLISH_STOPWORDS = {"the","a","an","is","in","on","at","to","for","of","and","or","i","me","we","you","it"}
    def word_tokenize(text):
        return re.findall(r"\w+", text.lower())

# ── Hindi keyword map ────────────────────────────────────────────────────────
HINDI_TO_ENGLISH = {
    "टमाटर": "tomato", "आलू": "potato", "प्याज": "onion",
    "पालक": "spinach", "गाजर": "carrot", "फूलगोभी": "cauliflower",
    "बंदगोभी": "cabbage", "लौकी": "bottle gourd", "करेला": "bitter gourd",
    "शिमला मिर्च": "capsicum", "केला": "banana", "सेब": "apple",
    "आम": "mango", "तरबूज": "watermelon", "अंगूर": "grapes",
    "संतरा": "orange", "पपीता": "papaya", "अनार": "pomegranate",
    "सब्जी": "vegetable", "फल": "fruit", "मूल्य": "price",
    "कीमत": "price", "उपलब्ध": "available", "ताज़ा": "fresh",
    "ऑर्डर": "order", "डिलीवरी": "delivery",
}

# ── Intent patterns ──────────────────────────────────────────────────────────
INTENTS = {
    "greeting":      r"\b(hello|hi|hey|namaste|namaskar|hii|helo)\b",
    "price_query":   r"\b(price|cost|rate|kitna|kitne|daam|keemat|cost)\b",
    "availability":  r"\b(available|stock|hai|milega|milta|uplabdh)\b",
    "order_help":    r"\b(order|buy|kharidna|kharido|purchase)\b",
    "delivery":      r"\b(delivery|deliver|pahunchao|time|kitne time|kab)\b",
    "farewell":      r"\b(bye|goodbye|alvida|shukriya|thanks|thank you|dhanyavad)\b",
}

RESPONSES = {
    "greeting": [
        "Namaste! Welcome to NR Sabji Mandi. How can I help you today?",
        "Hello! Fresh vegetables and fruits are just a tap away. What are you looking for?",
    ],
    "farewell": [
        "Thank you for visiting NR Sabji Mandi! Come again for fresh produce.",
        "Alvida! Order again soon for fresh vegetables and fruits.",
    ],
    "delivery": [
        "We deliver within Udaipur city. Free delivery on orders above Rs.300. "
        "Delivery time is typically 30-60 minutes.",
    ],
    "order_help": [
        "Add items to your cart, enter your delivery address, and choose Cash on Delivery "
        "or online payment. It is very simple!",
    ],
    "default": [
        "I did not quite understand that. You can ask me about products, prices, "
        "availability, or delivery details.",
    ],
}


def _translate_hindi(text: str) -> str:
    """Replace Hindi product names with English equivalents."""
    for hindi, english in HINDI_TO_ENGLISH.items():
        text = text.replace(hindi, english)
    return text


def _tokenize_and_lemmatize(text: str) -> list:
    try:
        tokens = word_tokenize(text.lower())
    except Exception:
        tokens = text.lower().split()
    tokens = [lemmatizer.lemmatize(t) for t in tokens
              if t.isalpha() and t not in ENGLISH_STOPWORDS]
    return tokens


def _detect_intent(text: str) -> str:
    text_lower = text.lower()
    for intent, pattern in INTENTS.items():
        if re.search(pattern, text_lower):
            return intent
    return "default"


def _search_products_nlp(tokens: list) -> list:
    if not tokens:
        return []
    conditions = [
        or_(
            Product.name.ilike(f"%{t}%"),
            Product.name_hi.ilike(f"%{t}%"),
            Product.tags.ilike(f"%{t}%"),
        )
        for t in tokens
    ]
    from sqlalchemy import or_ as sql_or
    results = Product.query.filter(sql_or(*conditions), Product.is_available == True).limit(5).all()
    return results


# ── Main chatbot endpoint ────────────────────────────────────────────────────

@chatbot_bp.route("/message", methods=["POST"])
def chatbot_message():
    data = request.get_json()
    user_message = data.get("message", "").strip()

    if not user_message:
        return jsonify({"error": "Message is required"}), 400

    # 1. Translate Hindi to English
    translated = _translate_hindi(user_message)

    # 2. Tokenize + lemmatize
    tokens = _tokenize_and_lemmatize(translated)

    # 3. Detect intent
    intent = _detect_intent(translated)

    # 4. Search products from tokens
    products = _search_products_nlp(tokens)

    # 5. Build response
    import random
    if intent in RESPONSES and intent != "default":
        reply = random.choice(RESPONSES[intent])
    elif products:
        names = ", ".join(p.name for p in products)
        reply = f"I found these for you: {names}. Check them out!"
    elif intent == "price_query":
        reply = ("I could not find the specific item. "
                 "You can search for it in our product list or ask me the exact name.")
    else:
        reply = random.choice(RESPONSES["default"])

    product_data = [
        {"id": p.id, "name": p.name, "price": p.price_per_unit,
         "unit": p.unit, "image_url": p.image_url}
        for p in products
    ]

    return jsonify({
        "reply":          reply,
        "intent":         intent,
        "tokens":         tokens,
        "products_found": product_data,
        "translated":     translated if translated != user_message else None,
    }), 200