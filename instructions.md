# Business & Technical Requirements: Shop Supply Management System

## 1. Project Overview
A lightweight, browser-based management system to track product distribution across multiple retail shops. This system replaces traditional paper bill books with a digital interface to manage inventory, pricing, and sales history.

---

## 2. Business Requirements (BR)

### BR 1: Shop Management
* Ability to add, edit, and view a list of retail shops (Customer base).
* Store Shop Name, Contact Number, and Location.

### BR 2: Product Management
* Maintain a master list of products.
* Store Product Name, Cost Price, and Default Selling Price (to shops).

### BR 3: Transaction/Billing Management
* Create a "Supply Entry" (Bill) for a specific shop.
* Select multiple items per bill with quantities.
* Auto-calculation of:
    * Line item total (Price x Quantity).
    * Grand total per bill.
* Date-stamping for every entry.

### BR 4: Sales History
* View a history of all supplies made to a specific shop.
* Search/Filter bills by shop name or date.

---

## 3. Technical Requirements (TR)

### TR 1: Frontend Stack
* **HTML5 & JavaScript (ES6+):** Core structure and logic.
* **Tailwind CSS:** For a modern, responsive UI (via CDN for easy setup).
* **Icons:** Lucide-icons or Heroicons for visual clarity.

### TR 2: Data Storage (Offline-First)
* **Dexie.js:** A wrapper for IndexedDB to store data locally in the user's browser. 
* *Benefit:* No cloud server/hosting costs required for initial use.

### TR 3: Database Schema
* **Shops Table:** `++id, name, phone, address`
* **Products Table:** `++id, name, price`
* **Bills Table:** `++id, shopId, totalAmount, date`
* **BillItems Table:** `++id, billId, productId, quantity, priceAtTime`

### TR 4: User Interface (UI) Sections
1.  **Dashboard:** Quick summary of total shops and recent bills.
2.  **Inventory Tab:** Add/Update products.
3.  **Shops Tab:** Register new shops.
4.  **New Entry:** A form to select a shop and add items to a "cart" to generate a bill.
5.  **History:** A searchable table of past transactions.

---

## 4. Implementation Roadmap
1.  **Setup:** Create `index.html` and link Tailwind CSS and Dexie.js via CDN.
2.  **Database Init:** Initialize Dexie database in `app.js`.
3.  **CRUD Operations:** Write functions to Add/Get Shops and Products.
4.  **Billing Logic:** Create a function to save a bill and update `BillItems`.
5.  **UI Rendering:** Dynamic DOM updates using Vanilla JS to show lists and totals.