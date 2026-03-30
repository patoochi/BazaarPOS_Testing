# 🏪 BazaarOS — Modern Retail POS & Inventory System

**BazaarOS** is a professional, high-performance Single-Page Application (SPA) designed for modern retail owners. Built with a focus on speed, aesthetics, and real-time synchronization, it provides a seamless experience for managing sales, stock, and store profiles.

![BazaarOS Banner](https://img.shields.io/badge/Status-Beta-blueviolet?style=for-the-badge)
![Supabase Powered](https://img.shields.io/badge/Backend-Supabase-green?style=for-the-badge&logo=supabase)
![SPA Architecture](https://img.shields.io/badge/Architecture-SPA-orange?style=for-the-badge)

---

## ✨ Key Features

### 📊 Professional Dashboard
Real-time insights into your business performance. Track total sales, revenue, and low-stock items at a glance with a premium, glassmorphism UI.

### 💸 Dynamic Point of Sale (POS)
*   **Real-time Cart Sync:** Mobile and desktop views stay in sync using Supabase Realtime.
*   **Customer Display:** Dedicated secondary-monitor view for customers to see their tray.
*   **Barcode Scanning:** Support for standard SKU/Barcode inputs.
*   **Quick Actions:** One-tap checkout and receipt generation.

### 📦 Inventory Management
*   **Custom Categories:** Organize products with emojis or custom-uploaded icons.
*   **Stock Tracking:** Automatic inventory deduction upon sale.
*   **Image Uploads:** Optimized product image handling via Supabase Storage.

### 🛡️ Professional Auth & Profile
*   **Secure Registration:** Multi-column, validated account creation for store owners.
*   **Profile Locking:** "Read-Only" mode by default to prevent accidental data changes, with an easy-to-use edit toggle.
*   **Splash Screen:** Heavy, branded page-loader for a high-end application Feel.

---

## 🛠️ Tech Stack

*   **Frontend:** Vanilla HTML5, CSS3 (Modern Flexbox/Grid), Javascript (ES6+).
*   **Database & Core:** [Supabase](https://supabase.com/) (PostgreSQL).
*   **Authentication:** Supabase Auth with custom store metadata.
*   **Real-time:** Supabase Realtime for cross-device cart syncing.
*   **Storage:** Supabase Storage for product images and icons.
*   **Icons & Fonts:** FontAwesome 6+, Google Fonts (Inter/Outfit).

---

## 🚀 Quick Setup

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/your-username/RetailOS.git
    ```

2.  **Supabase Configuration:**
    *   Create a new project on [Supabase.com](https://supabase.com/).
    *   Run the provided SQL schemas for `profiles`, `categories`, `products`, and `sales`.
    *   Enable **Realtime** on the `active_carts` and `sales` tables.
    *   Update `js/supabase-config.js` with your Project URL and Anon Key.

3.  **Deploy:**
    *   Simply upload to GitHub Pages, Netlify, or Vercel. NO build step required!

---

## 🎨 Design Principles

BazaarOS is built with **Rich Aesthetics** in mind:
*   **Dark Mode Native:** Deep navy and slate palette for reduced eye strain during long shifts.
*   **Glassmorphism:** Subtle background blurs and border glows.
*   **Staggered Animations:** Smooth, micro-animated transitions for a "living" interface.

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

---

**BazaarOS** — Empowering small businesses with enterprise-grade tools.
