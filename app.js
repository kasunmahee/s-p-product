// Initialize Dexie Database
const db = new Dexie('POSMiniDB');
db.version(1).stores({
    shops: '++id, name, phone, address',
    products: '++id, name, costPrice, sellingPrice',
    bills: '++id, shopId, totalAmount, date',
    billItems: '++id, billId, productId, quantity, priceAtTime'
});

// App State
const appState = {
    cart: []
};

// Router
const router = {
    current: 'dashboard',
    navigate: async (viewId) => {
        // Hide all sections
        document.querySelectorAll('.page-section').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('active', 'text-blue-600');
            el.classList.add('text-gray-400');
        });

        // Show target section
        const target = document.getElementById(`view-${viewId}`);
        if (target) {
            target.classList.remove('hidden');
            // Update Nav
            const navId = viewId === 'billing' ? 'nav-dashboard' : `nav-${viewId}`;
            const navEl = document.getElementById(navId);
            if (navEl) {
                navEl.classList.add('active', 'text-blue-600');
                navEl.classList.remove('text-gray-400');
            }

            // Trigger load functions and await them
            if (viewId === 'dashboard') await dashboard.load();
            if (viewId === 'shops') await shops.renderList();
            if (viewId === 'products') await products.renderList();
            if (viewId === 'billing') await billing.init();
            if (viewId === 'history') {
                await historyView.loadFilters();
                await historyView.renderList();
            }
        }
    }
};

// Utilities
const utils = {
    formatCurrency: (amount) => {
        return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(amount);
    },
    toast: (message, type = 'success') => {
        const div = document.createElement('div');
        div.className = `fixed top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg text-white text-sm font-medium z-50 transition-all duration-300 ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`;
        div.textContent = message;
        document.body.appendChild(div);

        // Appear animation
        requestAnimationFrame(() => {
            div.style.opacity = '1';
            div.style.transform = 'translate(-50%, 0)';
        });

        setTimeout(() => {
            div.style.opacity = '0';
            setTimeout(() => div.remove(), 300);
        }, 3000);
    }
};

// Dashboard Module
const dashboard = {
    load: async () => {
        const shopCount = await db.shops.count();
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const bills = await db.bills.where('date').aboveOrEqual(startOfMonth).toArray();
        const totalSales = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);

        document.getElementById('dash-total-shops').textContent = shopCount;
        document.getElementById('dash-total-sales').textContent = utils.formatCurrency(totalSales);

        // Recent Transactions
        const recentBills = await db.bills.reverse().limit(5).toArray();
        const listEl = document.getElementById('dash-recent-list');
        listEl.innerHTML = '';

        if (recentBills.length === 0) {
            listEl.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">No transactions yet</div>';
            return;
        }

        for (const bill of recentBills) {
            const shop = await db.shops.get(bill.shopId);
            const div = document.createElement('div');
            div.className = 'bg-white p-3 rounded-xl border border-gray-100 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition';
            div.onclick = () => billViewer.open(bill.id);
            div.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="bg-blue-50 p-2 rounded-lg text-blue-600">
                        <i data-lucide="receipt" class="w-4 h-4"></i>
                    </div>
                    <div>
                        <div class="font-semibold text-sm text-gray-900">${shop ? shop.name : 'Unknown Shop'}</div>
                        <div class="text-xs text-gray-500">${new Date(bill.date).toLocaleDateString()}</div>
                    </div>
                </div>
                <div class="font-bold text-gray-900">${utils.formatCurrency(bill.totalAmount)}</div>
            `;
            listEl.appendChild(div);
        }
        lucide.createIcons();
    }
};

// Shops Module
const shops = {
    openAdd: () => {
        document.getElementById('shop-id').value = '';
        document.getElementById('shop-name').value = '';
        document.getElementById('shop-phone').value = '';
        document.getElementById('shop-address').value = '';
        openModal('shop-modal');
    },
    edit: async (id) => {
        const shop = await db.shops.get(id);
        if (shop) {
            document.getElementById('shop-id').value = shop.id;
            document.getElementById('shop-name').value = shop.name;
            document.getElementById('shop-phone').value = shop.phone;
            document.getElementById('shop-address').value = shop.address;
            openModal('shop-modal');
        }
    },
    save: async () => {
        const id = document.getElementById('shop-id').value;
        const name = document.getElementById('shop-name').value;
        const phone = document.getElementById('shop-phone').value;
        const address = document.getElementById('shop-address').value;

        if (!name) return utils.toast('Shop Name is required', 'error');

        if (id) {
            await db.shops.update(parseInt(id), { name, phone, address });
            utils.toast('Shop updated');
        } else {
            await db.shops.add({ name, phone, address });
            utils.toast('Shop added');
        }

        closeModal('shop-modal');
        shops.renderList();
    },
    renderList: async () => {
        const list = await db.shops.toArray();
        const container = document.getElementById('shops-list');
        container.innerHTML = '';

        if (list.length === 0) {
            container.innerHTML = '<div class="text-center py-10 text-gray-400">No shops found. Add one!</div>';
            return;
        }

        list.forEach(item => {
            const div = document.createElement('div');
            div.className = 'bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center';
            div.innerHTML = `
                <div>
                    <h3 class="font-bold text-gray-800">${item.name}</h3>
                    <p class="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <i data-lucide="map-pin" class="w-3 h-3"></i> ${item.address || 'No Address'}
                    </p>
                    <p class="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <i data-lucide="phone" class="w-3 h-3"></i> ${item.phone || 'No Phone'}
                    </p>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="shops.edit(${item.id})" class="p-2 text-gray-400 hover:text-blue-600 bg-gray-50 rounded-lg">
                        <i data-lucide="edit-2" class="w-4 h-4"></i>
                    </button>
                    <button onclick="billing.startWithShop(${item.id})" class="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-100 transition">
                        Bill
                    </button>
                </div>
            `;
            container.appendChild(div);
        });
        lucide.createIcons();
    }
};

// Products Module
const products = {
    openAdd: () => {
        document.getElementById('prod-id').value = '';
        document.getElementById('prod-name').value = '';
        document.getElementById('prod-cost').value = '';
        document.getElementById('prod-price').value = '';
        document.getElementById('prod-modal-title').textContent = 'Add Product';
        openModal('product-modal');
    },
    edit: async (id) => {
        const prod = await db.products.get(id);
        if (prod) {
            document.getElementById('prod-id').value = prod.id;
            document.getElementById('prod-name').value = prod.name;
            document.getElementById('prod-cost').value = prod.costPrice;
            document.getElementById('prod-price').value = prod.sellingPrice;
            document.getElementById('prod-modal-title').textContent = 'Edit Product';
            openModal('product-modal');
        }
    },
    save: async () => {
        const id = document.getElementById('prod-id').value;
        const name = document.getElementById('prod-name').value;
        const costPrice = parseFloat(document.getElementById('prod-cost').value) || 0;
        const sellingPrice = parseFloat(document.getElementById('prod-price').value) || 0;

        if (!name || !sellingPrice) return utils.toast('Name and Selling Price required', 'error');

        if (id) {
            await db.products.update(parseInt(id), { name, costPrice, sellingPrice });
            utils.toast('Product updated');
        } else {
            await db.products.add({ name, costPrice, sellingPrice });
            utils.toast('Product added');
        }

        closeModal('product-modal');
        products.renderList();
    },
    renderList: async () => {
        const list = await db.products.toArray();
        const container = document.getElementById('products-list');
        container.innerHTML = '';

        if (list.length === 0) {
            container.innerHTML = '<div class="text-center py-10 text-gray-400">No products found</div>';
            return;
        }

        list.forEach(item => {
            const div = document.createElement('div');
            div.className = 'bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center';
            div.innerHTML = `
                <div>
                    <h3 class="font-bold text-gray-800">${item.name}</h3>
                    <div class="flex gap-3 text-xs mt-1">
                        <span class="text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded">Sell: Rs ${item.sellingPrice}</span>
                        <span class="text-gray-400">Cost: Rs ${item.costPrice}</span>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="products.edit(${item.id})" class="p-2 text-gray-400 hover:text-blue-600 bg-gray-50 rounded-lg">
                        <i data-lucide="edit-2" class="w-4 h-4"></i>
                    </button>
                    <button class="text-gray-400 hover:text-red-500 transition p-2" onclick="products.delete(${item.id})">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });
        lucide.createIcons();
    },
    delete: async (id) => {
        if (confirm('Delete this product?')) {
            await db.products.delete(id);
            products.renderList();
        }
    }
};

// Billing Module
const billing = {
    init: async () => {
        // Reset Cart
        appState.cart = [];
        billing.renderCart();

        // Load Shops
        const shopList = await db.shops.toArray();
        const shopSelect = document.getElementById('billing-shop-select');
        shopSelect.innerHTML = '<option value="">Choose a shop...</option>';
        shopList.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            shopSelect.appendChild(opt);
        });

        // Load Products
        const prodList = await db.products.toArray();
        const prodSelect = document.getElementById('billing-product-select');
        prodSelect.innerHTML = '<option value="">Select Product...</option>';
        prodList.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.name} (Rs ${p.sellingPrice})`;
            opt.dataset.price = p.sellingPrice;
            opt.dataset.cost = p.costPrice; // track cost
            opt.dataset.name = p.name;
            prodSelect.appendChild(opt);
        });
    },
    startWithShop: async (shopId) => {
        await router.navigate('billing');
        document.getElementById('billing-shop-select').value = shopId;
    },
    addItem: () => {
        const prodSelect = document.getElementById('billing-product-select');
        const qtyInput = document.getElementById('billing-qty');

        const productId = parseInt(prodSelect.value);
        const qty = parseInt(qtyInput.value);

        if (!productId || !qty || qty <= 0) return utils.toast('Select valid product and quantity', 'error');

        const price = parseFloat(prodSelect.options[prodSelect.selectedIndex].dataset.price);
        const cost = parseFloat(prodSelect.options[prodSelect.selectedIndex].dataset.cost) || 0;
        const name = prodSelect.options[prodSelect.selectedIndex].dataset.name;

        // Check if exists
        const existing = appState.cart.find(i => i.productId === productId);
        if (existing) {
            existing.quantity += qty;
        } else {
            appState.cart.push({
                productId,
                name,
                price,
                cost,
                quantity: qty,
                total: price * qty
            });
        }

        // Reset inputs
        qtyInput.value = '';
        prodSelect.value = '';

        billing.renderCart();
    },
    removeItem: (index) => {
        appState.cart.splice(index, 1);
        billing.renderCart();
    },
    renderCart: () => {
        const container = document.getElementById('billing-cart-list');
        container.innerHTML = '';
        let grandTotal = 0;

        appState.cart.forEach((item, index) => {
            const lineTotal = item.price * item.quantity;
            grandTotal += lineTotal;

            const div = document.createElement('div');
            div.className = 'bg-white p-3 rounded-lg border border-gray-100 flex justify-between items-center text-sm';
            div.innerHTML = `
                <div class="flex-1">
                    <div class="font-medium text-gray-800">${item.name}</div>
                    <div class="text-xs text-gray-500">${item.quantity} x Rs ${item.price}</div>
                </div>
                <div class="font-bold text-gray-900 mr-3">Rs ${lineTotal}</div>
                <button onclick="billing.removeItem(${index})" class="text-red-400 hover:text-red-600">
                    <i data-lucide="x-circle" class="w-5 h-5"></i>
                </button>
            `;
            container.appendChild(div);
        });

        document.getElementById('billing-total-display').textContent = utils.formatCurrency(grandTotal);
        lucide.createIcons();
    },
    saveBill: async () => {
        const shopId = parseInt(document.getElementById('billing-shop-select').value);
        if (!shopId) return utils.toast('Please select a shop', 'error');
        if (appState.cart.length === 0) return utils.toast('Cart is empty', 'error');

        const totalAmount = appState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const totalCost = appState.cart.reduce((sum, item) => sum + (item.cost * item.quantity), 0);

        try {
            const billId = await db.bills.add({
                shopId,
                totalAmount,
                totalCost,
                date: new Date()
            });

            const billItems = appState.cart.map(item => ({
                billId,
                productId: item.productId,
                quantity: item.quantity,
                priceAtTime: item.price,
                costAtTime: item.cost
            }));

            await db.billItems.bulkAdd(billItems);

            utils.toast('Transaction saved successfully!');
            router.navigate('dashboard');
        } catch (e) {
            console.error(e);
            utils.toast('Error saving bill', 'error');
        }
    }
};


// Bill Viewer Module
const billViewer = {
    open: async (billId) => {
        const bill = await db.bills.get(billId);
        if (!bill) return utils.toast('Bill not found', 'error');

        const shop = await db.shops.get(bill.shopId);
        const items = await db.billItems.where('billId').equals(billId).toArray();
        const productsMap = new Map((await db.products.toArray()).map(p => [p.id, p]));

        // Populate Modal
        document.getElementById('bill-modal-shop').textContent = shop ? shop.name : 'Unknown Shop';
        document.getElementById('bill-modal-date').textContent = new Date(bill.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
        document.getElementById('bill-modal-total').textContent = utils.formatCurrency(bill.totalAmount);

        // Add Download Button
        const headerAction = document.getElementById('bill-modal-action');
        if (!headerAction) {
            const header = document.querySelector('#bill-modal .flex.justify-between.items-center');
            const div = document.createElement('div');
            div.id = 'bill-modal-action';
            div.className = 'flex gap-2';
            // Move close button inside
            const closeBtn = header.querySelector('button');

            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'text-blue-500 hover:text-blue-700';
            downloadBtn.innerHTML = '<i data-lucide="download" class="w-5 h-5"></i>';
            downloadBtn.onclick = () => billViewer.downloadPDF(bill.id);

            div.appendChild(downloadBtn);
            div.appendChild(closeBtn);
            header.appendChild(div);
        } else {
            // Update onclick
            const btn = headerAction.querySelector('button');
            btn.onclick = () => billViewer.downloadPDF(bill.id);
        }

        // Show Cost
        const costEl = document.getElementById('bill-modal-cost');
        if (costEl) costEl.textContent = bill.totalCost !== undefined ? utils.formatCurrency(bill.totalCost) : 'N/A';

        const listEl = document.getElementById('bill-modal-items');
        listEl.innerHTML = '';

        items.forEach(item => {
            const prod = productsMap.get(item.productId);
            const name = prod ? prod.name : 'Unknown Product';
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center text-sm border-b border-gray-50 pb-2 last:border-0';
            div.innerHTML = `
                <div>
                    <div class="font-medium text-gray-800">${name}</div>
                    <div class="text-xs text-gray-500">${item.quantity} x ${utils.formatCurrency(item.priceAtTime)}</div>
                </div>
                <div class="text-right">
                    <div class="font-semibold text-gray-700">${utils.formatCurrency(item.quantity * item.priceAtTime)}</div>
                    ${item.costAtTime ? `<div class="text-[10px] text-gray-400">Cost: ${utils.formatCurrency(item.quantity * item.costAtTime)}</div>` : ''}
                </div>
                <!-- Return Action -->
                <button onclick="billViewer.returnItem(${item.id}, ${bill.id}, '${name}')" class="ml-2 text-red-500 hover:bg-red-50 p-1.5 rounded-lg" title="Return Item">
                    <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
                </button>
            `;
            listEl.appendChild(div);
        });

        lucide.createIcons();
        openModal('bill-modal');
    },
    returnItem: async (itemId, billId, itemName) => {
        const item = await db.billItems.get(itemId);
        if (!item) return;

        const returnQty = prompt(`How many ${itemName || 'items'} to return? (Max: ${item.quantity})`, '1');
        if (returnQty === null) return;

        const qty = parseInt(returnQty);
        if (isNaN(qty) || qty <= 0 || qty > item.quantity) {
            return utils.toast('Invalid quantity', 'error');
        }

        // Calculate refund amounts
        const refundAmount = qty * item.priceAtTime;
        const refundCost = qty * (item.costAtTime || 0);

        // Update Bill Item
        if (qty === item.quantity) {
            await db.billItems.delete(itemId);
        } else {
            await db.billItems.update(itemId, { quantity: item.quantity - qty });
        }

        // Update Bill Totals
        const bill = await db.bills.get(billId);
        await db.bills.update(billId, {
            totalAmount: bill.totalAmount - refundAmount,
            totalCost: (bill.totalCost || 0) - refundCost
        });

        utils.toast('Item returned successfully');
        billViewer.open(billId); // Refresh modal

        // Refresh background lists if open
        if (!document.getElementById('view-dashboard').classList.contains('hidden')) dashboard.load();
        if (!document.getElementById('view-history').classList.contains('hidden')) historyView.renderList();
    },
    downloadPDF: async (billId) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const bill = await db.bills.get(billId);
        const shop = await db.shops.get(bill.shopId);
        const items = await db.billItems.where('billId').equals(billId).toArray();
        const productsMap = new Map((await db.products.toArray()).map(p => [p.id, p]));

        // Header
        doc.setFontSize(18);
        doc.text("POS Mini - Sales Invoice", 105, 15, null, null, "center");

        doc.setFontSize(10);
        doc.text(`Shop: ${shop ? shop.name : 'Unknown Shop'}`, 14, 25);
        doc.text(`Date: ${new Date(bill.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`, 14, 30);
        doc.text(`Bill ID: #${bill.id}`, 14, 35);

        // Table Data
        const body = items.map(item => {
            const prod = productsMap.get(item.productId);
            return [
                prod ? prod.name : 'Unknown',
                item.quantity,
                parseFloat(item.priceAtTime).toFixed(2),
                (item.quantity * item.priceAtTime).toFixed(2)
            ];
        });

        // Generate Table
        doc.autoTable({
            head: [['Product', 'Qty', 'Price', 'Total']],
            body: body,
            startY: 40,
            theme: 'striped',
            headStyles: { fillColor: [37, 99, 235] }
        });

        // Totals
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`Grand Total: Rs ${bill.totalAmount.toFixed(2)}`, 195, finalY, null, null, "right");

        // Save
        doc.save(`Invoice_${bill.id}_${shop ? shop.name : 'Shop'}.pdf`);
    }
};

// History Module
const historyView = {
    loadFilters: async () => {
        const shopsList = await db.shops.toArray();
        const select = document.getElementById('history-filter-shop');
        if (!select) return;

        // Keep first option
        select.innerHTML = '<option value="">All Shops</option>';
        shopsList.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            select.appendChild(opt);
        });
    },
    renderList: async () => {
        const shopFilterEl = document.getElementById('history-filter-shop');
        const shopFilter = shopFilterEl ? shopFilterEl.value : '';

        const dateStartEl = document.getElementById('history-date-start');
        const dateStart = dateStartEl ? dateStartEl.value : '';

        const dateEndEl = document.getElementById('history-date-end');
        const dateEnd = dateEndEl ? dateEndEl.value : '';

        // Base Query
        let bills = await db.bills.reverse().toArray();

        // Filter Logic
        bills = bills.filter(b => {
            let match = true;

            // Shop Filter
            if (shopFilter && b.shopId != shopFilter) match = false;

            // Date Filter
            if (match && (dateStart || dateEnd)) {
                const billDate = new Date(b.date);
                billDate.setHours(0, 0, 0, 0);

                if (dateStart) {
                    const start = new Date(dateStart);
                    start.setHours(0, 0, 0, 0);
                    if (billDate < start) match = false;
                }

                if (dateEnd && match) {
                    const end = new Date(dateEnd);
                    end.setHours(23, 59, 59, 999);
                    if (billDate > end) match = false;
                }
            }

            return match;
        });

        const container = document.getElementById('history-list');
        container.innerHTML = '';

        if (bills.length === 0) {
            container.innerHTML = '<div class="text-center py-10 text-gray-400">No transactions found</div>';
            return;
        }

        // Pre-fetch all needed shops for efficiency (N+1 prob solution)
        const allShopIds = [...new Set(bills.map(b => b.shopId))];
        const shopObjects = await db.shops.where('id').anyOf(allShopIds).toArray();
        const shopMap = new Map(shopObjects.map(s => [s.id, s]));

        for (const bill of bills) {
            const shop = shopMap.get(bill.shopId);
            const div = document.createElement('div');
            div.className = 'bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50 transition';
            div.onclick = () => billViewer.open(bill.id);
            div.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-bold text-gray-800">${shop ? shop.name : 'Unknown Shop'}</h4>
                        <p class="text-xs text-gray-500">${new Date(bill.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    </div>
                    <div class="text-right">
                        <span class="block font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg text-sm">${utils.formatCurrency(bill.totalAmount)}</span>
                        ${bill.totalCost !== undefined ? `<span class="block text-xs text-gray-400 mt-1">Cost: ${utils.formatCurrency(bill.totalCost)}</span>` : ''}
                    </div>
                </div>
                <div class="text-xs text-gray-400">Bill ID: #${bill.id}</div>
            `;
            container.appendChild(div);
        }
    }
};

// Modal Wrappers
window.openModal = (id) => {
    document.getElementById(id).classList.remove('hidden');
    document.getElementById(id).children[0].classList.remove('scale-95', 'opacity-0');
}
window.closeModal = (id) => {
    document.getElementById(id).classList.add('hidden');
}

// Global Event Listeners
document.getElementById('history-search')?.addEventListener('input', () => historyView.renderList());

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    router.navigate('dashboard');
    lucide.createIcons();
});
