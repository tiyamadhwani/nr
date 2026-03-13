# NR Sabji Mandi - Backend API

Flask-based REST API + WebSocket server for NR Sabji Mandi delivery app.

---

## Tech Stack
- **Flask** - Web framework
- **SQLAlchemy + SQLite** (upgradeable to PostgreSQL/MySQL)
- **JWT** - Authentication
- **Flask-SocketIO** - Real-time admin notifications
- **Flask-Mail** - Order email alerts to dextergrowth@gmail.com
- **NLTK** - Chatbot NLP (tokenization, lemmatization, stopwords)

---

## Setup & Run

### 1. Create virtual environment
```bash
cd nr-sabji-mandi-backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env with your Gmail SMTP credentials and other settings
```

### 4. Run the server
```bash
python run.py
```
Server starts at: **http://localhost:5000**

---

## API Endpoints

### Authentication  `/api/auth`
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Register new customer |
| POST | `/login` | Customer login |
| GET | `/me` | Get profile (JWT required) |
| PUT | `/me` | Update profile (JWT required) |
| POST | `/addresses` | Add delivery address |
| DELETE | `/addresses/<id>` | Delete address |

### Products  `/api/products`
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all products (filterable) |
| GET | `/<id>` | Get single product |
| GET | `/categories` | Get all categories |
| POST | `/` | Create product (admin) |
| PUT | `/<id>` | Update product (admin) |
| DELETE | `/<id>` | Delete product (admin) |

### Orders  `/api/orders`
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Place new order (JWT) |
| GET | `/my-orders` | Customer's order history (JWT) |
| GET | `/<id>` | Get order details (JWT) |
| GET | `/admin/all` | All orders (admin) |
| PUT | `/admin/<id>/status` | Update order status (admin) |

### Analytics  `/api/analytics`
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Today's summary (admin) |
| GET | `/daily-sales?days=7` | Daily sales chart (admin) |
| GET | `/peak-hours?days=7` | Peak order hours (admin) |
| GET | `/product-demand?days=7` | Top products (admin) |
| GET | `/failed-searches` | Unavailable product searches (admin) |

### Search  `/api/search`
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/?q=tomato` | Search products + log |

### Chatbot  `/api/chatbot`
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/message` | NLP chatbot (Hindi + English) |

### Admin  `/api/admin`
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/login` | Admin login |
| GET | `/customers` | List all customers |
| PUT | `/customers/<id>/toggle` | Activate/deactivate customer |

---

## Default Admin Credentials
```
Email:    admin@nrsabjimandi.com
Password: Admin@123
```
**Change these immediately in production!**

---

## Real-time Events (Socket.IO)
- **`join_admin`** - Admin panel joins `admins` room
- **`new_order`** - Emitted to admins when order placed (instant notification)
- **`order_update_<user_id>`** - Emitted to customer on status change

---

## Email Notifications
Every order triggers:
1. Admin notification to **dextergrowth@gmail.com**
2. Customer confirmation to their registered email

Configure SMTP in `.env` file (Gmail App Password recommended).
