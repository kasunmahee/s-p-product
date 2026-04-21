// Initialize Supabase Database
const supabaseUrl = 'https://gjsatpmpromnuuddnyzo.supabase.co';
const supabaseKey = 'sb_publishable_ebifLrn_a3NW0FfVCAe94g_SCYKzygY';
const supaClient = window.supabase.createClient(supabaseUrl, supabaseKey);

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
        try {
            const { count: shopCount } = await supaClient.from('shops').select('*', { count: 'exact', head: true });
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const { data: bills } = await supaClient.from('bills').select('*').gte('date', startOfMonth.toISOString());
            const totalSales = bills ? bills.reduce((sum, bill) => sum + Number(bill.totalAmount), 0) : 0;

            document.getElementById('dash-total-shops').textContent = shopCount || 0;
            document.getElementById('dash-total-sales').textContent = utils.formatCurrency(totalSales);

            // Recent Transactions
            const { data: allRecentBills } = await supaClient.from('bills').select('*, shops(*)').order('date', { ascending: false }).limit(50);
            const listEl = document.getElementById('dash-recent-list');
            listEl.innerHTML = '';

            let recentBills = [];
            if (allRecentBills) {
                recentBills = allRecentBills.slice(0, 5); // Take top 5
            }

            if (!recentBills || recentBills.length === 0) {
                listEl.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">No pending transactions yet</div>';
                return;
            }

            for (const bill of recentBills) {
                const shop = bill.shops;
                
                const paid = bill.paidAmount || 0;
                const isPaid = paid >= (bill.totalCost || 0);
                const statusBadge = isPaid 
                    ? `<span class="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold ml-2">PAID</span>`
                    : paid > 0 
                        ? `<span class="bg-yellow-100 text-yellow-700 text-[10px] px-2 py-0.5 rounded-full font-bold ml-2">PARTIAL</span>`
                        : `<span class="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-bold ml-2">UNPAID</span>`;
                
                const div = document.createElement('div');
                div.className = 'bg-white p-3 rounded-xl border border-gray-100 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition';
                div.onclick = () => billViewer.open(bill.id);
                div.innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="bg-blue-50 p-2 rounded-lg text-blue-600">
                            <i data-lucide="receipt" class="w-4 h-4"></i>
                        </div>
                        <div>
                            <div class="font-semibold text-sm text-gray-900 flex items-center">${shop ? shop.name : 'Unknown Shop'} ${statusBadge}</div>
                            <div class="text-xs text-gray-500">${new Date(bill.date).toLocaleDateString()}</div>
                        </div>
                    </div>
                    <div class="font-bold text-gray-900">${utils.formatCurrency(bill.totalCost || 0)}</div>
                `;
                listEl.appendChild(div);
            }
            lucide.createIcons();
        } catch (e) {
            console.error('Dashboard Load Error:', e);
            utils.toast('Failed to load dashboard data. Check database connection.', 'error');
        }
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
        try {
            const { data: shop } = await supaClient.from('shops').select('*').eq('id', id).single();
            if (shop) {
                document.getElementById('shop-id').value = shop.id;
                document.getElementById('shop-name').value = shop.name;
                document.getElementById('shop-phone').value = shop.phone;
                document.getElementById('shop-address').value = shop.address;
                openModal('shop-modal');
            }
        } catch(e) {
            console.error(e);
        }
    },
    save: async () => {
        const id = document.getElementById('shop-id').value;
        const name = document.getElementById('shop-name').value;
        const phone = document.getElementById('shop-phone').value;
        const address = document.getElementById('shop-address').value;

        if (!name) return utils.toast('Shop Name is required', 'error');

        try {
            if (id) {
                await supaClient.from('shops').update({ name, phone, address }).eq('id', parseInt(id));
                utils.toast('Shop updated');
            } else {
                await supaClient.from('shops').insert({ name, phone, address });
                utils.toast('Shop added');
            }
            closeModal('shop-modal');
            shops.renderList();
        } catch (e) {
            console.error(e);
            utils.toast('Error saving shop', 'error');
        }
    },
    renderList: async () => {
        try {
            const { data: list } = await supaClient.from('shops').select('*').order('id', { ascending: true });
            const container = document.getElementById('shops-list');
            container.innerHTML = '';

            if (!list || list.length === 0) {
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
        } catch (e) {
            console.error(e);
        }
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
        try {
            const { data: prod } = await supaClient.from('products').select('*').eq('id', id).single();
            if (prod) {
                document.getElementById('prod-id').value = prod.id;
                document.getElementById('prod-name').value = prod.name;
                document.getElementById('prod-cost').value = prod.costPrice;
                document.getElementById('prod-price').value = prod.sellingPrice;
                document.getElementById('prod-modal-title').textContent = 'Edit Product';
                openModal('product-modal');
            }
        } catch(e) {
            console.error(e);
        }
    },
    save: async () => {
        const id = document.getElementById('prod-id').value;
        const name = document.getElementById('prod-name').value;
        const costPrice = parseFloat(document.getElementById('prod-cost').value) || 0;
        const sellingPrice = parseFloat(document.getElementById('prod-price').value) || 0;

        if (!name || !sellingPrice) return utils.toast('Name and Selling Price required', 'error');

        try {
            if (id) {
                await supaClient.from('products').update({ name, costPrice, sellingPrice }).eq('id', parseInt(id));
                utils.toast('Product updated');
            } else {
                await supaClient.from('products').insert({ name, costPrice, sellingPrice });
                utils.toast('Product added');
            }

            closeModal('product-modal');
            products.renderList();
        } catch(e) {
            console.error(e);
        }
    },
    renderList: async () => {
        try {
            const { data: list } = await supaClient.from('products').select('*').order('id', { ascending: true });
            const container = document.getElementById('products-list');
            container.innerHTML = '';

            if (!list || list.length === 0) {
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
        } catch(e) {
            console.error(e);
        }
    },
    delete: async (id) => {
        if (confirm('Delete this product?')) {
            await supaClient.from('products').delete().eq('id', id);
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

        try {
            // Load Shops
            const { data: shopList } = await supaClient.from('shops').select('*').order('name');
            const shopSelect = document.getElementById('billing-shop-select');
            shopSelect.innerHTML = '<option value="">Choose a shop...</option>';
            if (shopList) {
                shopList.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.textContent = s.name;
                    shopSelect.appendChild(opt);
                });
            }

            // Load Products
            const { data: prodList } = await supaClient.from('products').select('*').order('name');
            const prodSelect = document.getElementById('billing-product-select');
            prodSelect.innerHTML = '<option value="">Select Product...</option>';
            if (prodList) {
                prodList.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.id;
                    opt.textContent = `${p.name} (Rs ${p.sellingPrice})`;
                    opt.dataset.price = p.sellingPrice;
                    opt.dataset.cost = p.costPrice; // track cost
                    opt.dataset.name = p.name;
                    prodSelect.appendChild(opt);
                });
            }
        } catch (e) {
            console.error(e);
        }
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
            const { data: billData, error: billError } = await supaClient.from('bills').insert({
                shopId,
                totalAmount,
                totalCost,
                date: new Date().toISOString()
            }).select().single();
            
            if (billError) throw billError;
            const billId = billData.id;

            const billItems = appState.cart.map(item => ({
                billId,
                productId: item.productId,
                quantity: item.quantity,
                priceAtTime: item.price,
                costAtTime: item.cost
            }));

            const { error: itemsError } = await supaClient.from('billitems').insert(billItems);
            if (itemsError) throw itemsError;

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
        try {
            const { data: bill } = await supaClient.from('bills').select('*').eq('id', billId).single();
            if (!bill) return utils.toast('Bill not found', 'error');

            const { data: shop } = await supaClient.from('shops').select('*').eq('id', bill.shopId).single();
            const { data: items } = await supaClient.from('billitems').select('*').eq('billId', billId);
            
            const { data: allProducts } = await supaClient.from('products').select('*');
            const productsMap = new Map((allProducts || []).map(p => [p.id, p]));

            // Populate Modal
            document.getElementById('bill-modal-shop').textContent = shop ? shop.name : 'Unknown Shop';
            document.getElementById('bill-modal-date').textContent = new Date(bill.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
            document.getElementById('bill-modal-total').textContent = utils.formatCurrency(bill.totalCost || 0);

            // Add Download & Delete Buttons
            const headerAction = document.getElementById('bill-modal-action');
            if (!headerAction) {
                const header = document.querySelector('#bill-modal .flex.justify-between.items-center');
                const div = document.createElement('div');
                div.id = 'bill-modal-action';
                div.className = 'flex gap-2 items-center';

                // Move close button inside
                const closeBtn = header.querySelector('button');

                const downloadBtn = document.createElement('button');
                downloadBtn.className = 'text-blue-500 hover:text-blue-700 p-1';
                downloadBtn.innerHTML = '<i data-lucide="download" class="w-5 h-5"></i>';
                downloadBtn.onclick = () => billViewer.downloadPDF(bill.id);

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'text-red-500 hover:text-red-700 ml-2 p-1';
                deleteBtn.innerHTML = '<i data-lucide="trash-2" class="w-5 h-5"></i>';
                deleteBtn.onclick = () => billViewer.deleteBill(bill.id);

                div.appendChild(downloadBtn);
                div.appendChild(deleteBtn);
                if (closeBtn && closeBtn.parentNode === header) div.appendChild(closeBtn);

                header.appendChild(div);
            } else {
                const btns = headerAction.querySelectorAll('button');
                if (btns.length >= 2) {
                    btns[0].onclick = () => billViewer.downloadPDF(bill.id);
                    btns[1].onclick = () => billViewer.deleteBill(bill.id);
                }
            }

            // Calculate paid and balance
            const paid = bill.paidAmount || 0;
            const balance = (bill.totalCost || 0) - paid;

            const paidEl = document.getElementById('bill-modal-paid');
            if (paidEl) paidEl.textContent = utils.formatCurrency(paid);

            const balanceEl = document.getElementById('bill-modal-balance');
            if (balanceEl) balanceEl.textContent = utils.formatCurrency(balance);

            const listEl = document.getElementById('bill-modal-items');
            listEl.innerHTML = '';

            if (items) {
                items.forEach(item => {
                    const prod = productsMap.get(item.productId);
                    const name = prod ? prod.name : 'Unknown Product';
                    item._name = name; // saved for payment module

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
            }

            // Payment Options Button
            const paymentBtn = document.getElementById('bill-modal-payment-btn');
            if (paymentBtn) {
                if (balance <= 0) {
                    paymentBtn.classList.add('opacity-50', 'cursor-not-allowed');
                    paymentBtn.onclick = () => utils.toast('Bill is fully paid!', 'success');
                } else {
                    paymentBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    paymentBtn.onclick = () => {
                        paymentModule.open(bill.id, bill.totalCost || 0, paid, items);
                    };
                }
            }

            // Payment History Button
            const historyBtn = document.getElementById('bill-modal-payment-history-btn');
            if (historyBtn) {
                historyBtn.onclick = () => {
                    paymentHistoryModule.open(bill.id);
                };
            }

            lucide.createIcons();
            openModal('bill-modal');
        } catch (e) {
            console.error(e);
        }
    },

    returnItem: async (itemId, billId, itemName) => {
        try {
            const { data: item } = await supaClient.from('billitems').select('*').eq('id', itemId).single();
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
                await supaClient.from('billitems').delete().eq('id', itemId);
            } else {
                await supaClient.from('billitems').update({ quantity: item.quantity - qty }).eq('id', itemId);
            }

            // Update Bill Totals
            const { data: bill } = await supaClient.from('bills').select('*').eq('id', billId).single();
            await supaClient.from('bills').update({
                totalAmount: bill.totalAmount - refundAmount,
                totalCost: (bill.totalCost || 0) - refundCost
            }).eq('id', billId);

            utils.toast('Item returned successfully');
            billViewer.open(billId); // Refresh modal

            // Refresh background lists if open
            if (!document.getElementById('view-dashboard').classList.contains('hidden')) dashboard.load();
            if (!document.getElementById('view-history').classList.contains('hidden')) historyView.renderList();
        } catch (e) {
            console.error(e);
        }
    },

    downloadPDF: async (billId) => {
        try {
            if (!window.jspdf) return utils.toast('PDF Library not loaded', 'error');
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            const { data: bill } = await supaClient.from('bills').select('*').eq('id', billId).single();
            const { data: shop } = await supaClient.from('shops').select('*').eq('id', bill.shopId).single();
            const { data: items } = await supaClient.from('billitems').select('*').eq('billId', billId);
            const { data: allProducts } = await supaClient.from('products').select('*');
            const productsMap = new Map((allProducts || []).map(p => [p.id, p]));

            // Header
            doc.setFontSize(18);
            doc.text("S&P Product - Sales Invoice", 105, 15, null, null, "center");

            doc.setFontSize(10);
            doc.text(`Shop: ${shop ? shop.name : 'Unknown Shop'}`, 14, 25);
            doc.text(`Date: ${new Date(bill.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`, 14, 30);
            doc.text(`Bill ID: #${bill.id}`, 14, 35);

            // Table Data
            const body = (items || []).map(item => {
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
        } catch (e) {
            console.error(e);
        }
    },

    deleteBill: async (billId) => {
        try {
            if (confirm('Are you sure you want to delete this bill? This cannot be undone.')) {
                await supaClient.from('bills').delete().eq('id', billId);
                await supaClient.from('billitems').delete().eq('billId', billId);
                utils.toast('Bill deleted successfully');
                closeModal('bill-modal');

                // Refresh
                if (!document.getElementById('view-dashboard').classList.contains('hidden')) dashboard.load();
                if (!document.getElementById('view-history').classList.contains('hidden')) historyView.renderList();
            }
        } catch (e) {
            console.error(e);
        }
    }
};

// Payment Module
const paymentModule = {
    state: {
        billId: null,
        total: 0,
        paid: 0,
        balance: 0,
        activeTab: 'amount',
        method: 'Cash',
        itemsSelectedAmount: 0,
        selectedItems: []
    },
    
    open: async (billId, total, paid, items) => {
        paymentModule.state.billId = billId;
        paymentModule.state.total = total || 0;
        paymentModule.state.paid = paid || 0;
        paymentModule.state.balance = total - (paid || 0);

        if (paymentModule.state.balance <= 0) {
            return utils.toast('This bill is already fully paid.', 'success');
        }

        document.getElementById('payment-modal-due').textContent = utils.formatCurrency(paymentModule.state.balance);
        document.getElementById('payment-modal-total').textContent = utils.formatCurrency(paymentModule.state.total);
        
        // Reset Inputs
        document.getElementById('payment-input-amount').value = '';
        paymentModule.state.itemsSelectedAmount = 0;
        paymentModule.state.selectedItems = [];
        document.getElementById('payment-items-total').textContent = utils.formatCurrency(0);

        // Populate Items for Item-Wise View
        const listEl = document.getElementById('payment-items-list');
        listEl.innerHTML = '';
        
        items.forEach((item) => {
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center bg-white p-2 rounded border border-gray-100';
            const itemTotal = item.quantity * (item.costAtTime || 0);
            div.innerHTML = `
                <label class="flex items-center gap-3 cursor-pointer flex-1">
                    <input type="checkbox" class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" 
                        onchange="paymentModule.toggleItem(this, ${itemTotal}, ${item.id})">
                    <div>
                        <div class="text-sm font-medium text-gray-800">${item._name || 'Item'} (x${item.quantity})</div>
                        <div class="text-xs text-gray-500">Cost: ${utils.formatCurrency(item.costAtTime || 0)} each</div>
                    </div>
                </label>
                <div class="font-semibold text-gray-700 text-sm">${utils.formatCurrency(itemTotal)}</div>
            `;
            listEl.appendChild(div);
        });

        // Reset Method to Cash
        const btns = document.querySelectorAll('.payment-method-btn');
        if(btns.length > 0) paymentModule.setMethod('Cash', btns[0]);

        paymentModule.switchTab('amount');
        openModal('payment-modal');
    },

    switchTab: (tab) => {
        paymentModule.state.activeTab = tab;
        const btnAmount = document.getElementById('tab-btn-amount');
        const btnItems = document.getElementById('tab-btn-items');
        const viewAmount = document.getElementById('payment-tab-amount');
        const viewItems = document.getElementById('payment-tab-items');

        if (tab === 'amount') {
            btnAmount.className = "flex-1 py-2 text-sm font-semibold text-blue-600 border-b-2 border-blue-600";
            btnItems.className = "flex-1 py-2 text-sm font-semibold text-gray-500 border-b-2 border-transparent hover:text-gray-700";
            viewAmount.classList.remove('hidden');
            viewItems.classList.add('hidden');
        } else {
            btnItems.className = "flex-1 py-2 text-sm font-semibold text-blue-600 border-b-2 border-blue-600";
            btnAmount.className = "flex-1 py-2 text-sm font-semibold text-gray-500 border-b-2 border-transparent hover:text-gray-700";
            viewItems.classList.remove('hidden');
            viewAmount.classList.add('hidden');
        }
    },

    toggleItem: (checkbox, amount, itemId) => {
        if (checkbox.checked) {
            paymentModule.state.itemsSelectedAmount += amount;
            paymentModule.state.selectedItems.push(itemId);
        } else {
            paymentModule.state.itemsSelectedAmount -= amount;
            paymentModule.state.selectedItems = paymentModule.state.selectedItems.filter(id => id !== itemId);
        }
        document.getElementById('payment-items-total').textContent = utils.formatCurrency(paymentModule.state.itemsSelectedAmount);
    },

    setMethod: (method, btnElem) => {
        paymentModule.state.method = method;
        document.querySelectorAll('.payment-method-btn').forEach(btn => {
            btn.className = "payment-method-btn bg-gray-50 border-gray-200 text-gray-600 border rounded-lg py-2 text-sm font-semibold hover:bg-gray-100 transition";
        });
        btnElem.className = "payment-method-btn active bg-blue-50 border-blue-200 text-blue-700 border rounded-lg py-2 text-sm font-semibold transition";
    },

    save: async () => {
        let payAmount = 0;
        let itemsPaidJson = null;

        if (paymentModule.state.activeTab === 'amount') {
            payAmount = parseFloat(document.getElementById('payment-input-amount').value) || 0;
        } else {
            payAmount = paymentModule.state.itemsSelectedAmount;
            itemsPaidJson = paymentModule.state.selectedItems; 
        }

        if (payAmount <= 0) return utils.toast('Please select items or enter a valid amount to pay.', 'error');
        if (payAmount > paymentModule.state.balance) {
            return utils.toast('Amount exceeds the balance due: ' + utils.formatCurrency(paymentModule.state.balance), 'error');
        }

        try {
            // 1. Insert into payments table
            const { error: payError } = await supaClient.from('payments').insert({
                billId: paymentModule.state.billId,
                amount: payAmount,
                method: paymentModule.state.method,
                itemsPaid: itemsPaidJson
            });

            if (payError) throw payError;

            // 2. Update bills table paidAmount
            const newPaidTotal = paymentModule.state.paid + payAmount;
            const { error: billError } = await supaClient.from('bills').update({
                paidAmount: newPaidTotal
            }).eq('id', paymentModule.state.billId);

            if (billError) throw billError;

            utils.toast('Payment saved successfully!', 'success');
            closeModal('payment-modal');

            // Refresh UI
            billViewer.open(paymentModule.state.billId);
            if (!document.getElementById('view-dashboard').classList.contains('hidden')) dashboard.load();
            if (!document.getElementById('view-history').classList.contains('hidden')) historyView.renderList();

        } catch(e) {
            console.error(e);
            utils.toast('Error saving payment. Check network or DB.', 'error');
        }
    }
};

// Payment History Module
const paymentHistoryModule = {
    state: {
        billId: null,
        payments: [],
        bill: null
    },
    open: async (billId) => {
        paymentHistoryModule.state.billId = billId;
        const listEl = document.getElementById('payment-history-list');
        listEl.innerHTML = '<div class="text-center text-gray-400 text-sm py-8">Loading history...</div>';
        
        openModal('payment-history-modal');

        try {
            const { data: bill } = await supaClient.from('bills').select('*').eq('id', billId).single();
            const { data: payments } = await supaClient.from('payments').select('*').eq('billId', billId).order('date', { ascending: false });
            
            paymentHistoryModule.state.bill = bill;
            paymentHistoryModule.state.payments = payments || [];
            
            if (!payments || payments.length === 0) {
                listEl.innerHTML = '<div class="text-center text-gray-400 text-sm py-8">No payments recorded yet.</div>';
                document.getElementById('payment-history-summary').textContent = `Total Cost: ${utils.formatCurrency(bill.totalCost || 0)} | Paid: 0.00`;
                return;
            }

            listEl.innerHTML = '';
            let totalFetchedPaid = 0;

            payments.forEach(p => {
                totalFetchedPaid += p.amount;
                const div = document.createElement('div');
                div.className = 'bg-white p-3 rounded-lg border border-gray-100 flex justify-between items-center';
                div.innerHTML = `
                    <div>
                        <div class="font-bold text-gray-800 text-sm">${utils.formatCurrency(p.amount)}</div>
                        <div class="text-xs text-gray-500 mt-1 flex items-center gap-2">
                            <span class="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase">${p.method}</span>
                            ${new Date(p.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </div>
                    </div>
                `;
                listEl.appendChild(div);
            });

            document.getElementById('payment-history-summary').textContent = `Total Cost: ${utils.formatCurrency(bill.totalCost || 0)} | Total Paid: ${utils.formatCurrency(totalFetchedPaid)}`;

            // Setup download button
            const dlBtn = document.getElementById('phistory-download-btn');
            if (dlBtn) dlBtn.onclick = () => paymentHistoryModule.downloadPDF();

        } catch (e) {
            console.error(e);
            listEl.innerHTML = '<div class="text-center text-red-400 text-sm py-8">Failed to load history</div>';
        }
    },
    downloadPDF: async () => {
        try {
            if (!window.jspdf) return utils.toast('PDF Library not loaded', 'error');
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            const bill = paymentHistoryModule.state.bill;
            const payments = paymentHistoryModule.state.payments;
            if (!payments || payments.length === 0) return utils.toast('No payments to export', 'error');

            const { data: shop } = await supaClient.from('shops').select('*').eq('id', bill.shopId).single();

            // Header
            doc.setFontSize(18);
            doc.text("S&P Product - Payment History", 105, 15, null, null, "center");

            doc.setFontSize(10);
            doc.text(`Shop: ${shop ? shop.name : 'Unknown Shop'}`, 14, 25);
            doc.text(`Bill ID: #${bill.id}`, 14, 30);
            doc.text(`Bill Date: ${new Date(bill.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`, 14, 35);
            doc.text(`Total Cost: Rs ${parseFloat(bill.totalCost || 0).toFixed(2)}`, 14, 40);

            const body = payments.map(p => [
                new Date(p.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
                p.method,
                parseFloat(p.amount).toFixed(2)
            ]);

            doc.autoTable({
                head: [['Date', 'Method', 'Amount Paid']],
                body: body,
                startY: 45,
                theme: 'striped',
                headStyles: { fillColor: [37, 99, 235] }
            });

            const finalY = doc.lastAutoTable.finalY + 10;
            const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(`Total Paid: Rs ${totalPaid.toFixed(2)}`, 195, finalY, null, null, "right");
            
            const balance = (bill.totalCost || 0) - totalPaid;
            doc.setFont(undefined, 'normal');
            doc.text(`Remaining Balance: Rs ${balance.toFixed(2)}`, 195, finalY + 7, null, null, "right");

            doc.save(`Payment_History_Bill_${bill.id}.pdf`);
        } catch (e) {
            console.error(e);
            utils.toast('Failed to generate PDF', 'error');
        }
    }
};

// History Module
const historyView = {
    loadFilters: async () => {
        try {
            const { data: shopsList } = await supaClient.from('shops').select('*').order('name');
            const select = document.getElementById('history-filter-shop');
            if (!select) return;

            // Keep first option
            select.innerHTML = '<option value="">All Shops</option>';
            if (shopsList) {
                shopsList.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.textContent = s.name;
                    select.appendChild(opt);
                });
            }
        } catch(e) {
            console.error(e);
        }
    },
    getFilteredBills: async () => {
        try {
            const shopFilterEl = document.getElementById('history-filter-shop');
            const shopFilter = shopFilterEl ? shopFilterEl.value : '';

            const dateStartEl = document.getElementById('history-date-start');
            const dateStart = dateStartEl ? dateStartEl.value : '';

            const dateEndEl = document.getElementById('history-date-end');
            const dateEnd = dateEndEl ? dateEndEl.value : '';

            // Base Query
            let { data: bills } = await supaClient.from('bills').select('*').order('date', { ascending: false });
            if (!bills) return [];

            // Filter Logic
            return bills.filter(b => {
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
        } catch(e) {
            console.error(e);
            return [];
        }
    },

    renderList: async () => {
        try {
            const bills = await historyView.getFilteredBills();
            const container = document.getElementById('history-list');
            container.innerHTML = '';

            if (bills.length === 0) {
                container.innerHTML = '<div class="text-center py-10 text-gray-400">No transactions found</div>';
                return;
            }

            // Pre-fetch all needed shops for efficiency
            const allShopIds = [...new Set(bills.map(b => b.shopId))];
            const { data: shopObjects } = await supaClient.from('shops').select('*').in('id', allShopIds);
            const shopMap = new Map((shopObjects || []).map(s => [s.id, s]));

            for (const bill of bills) {
                const shop = shopMap.get(bill.shopId);
                
                const paid = bill.paidAmount || 0;
                const isPaid = paid >= (bill.totalCost || 0);
                const statusBadge = isPaid 
                    ? `<span class="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold ml-2">PAID</span>`
                    : paid > 0 
                        ? `<span class="bg-yellow-100 text-yellow-700 text-[10px] px-2 py-0.5 rounded-full font-bold ml-2">PARTIAL</span>`
                        : `<span class="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-bold ml-2">UNPAID</span>`;
                
                const div = document.createElement('div');
                div.className = 'bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50 transition';
                div.onclick = () => billViewer.open(bill.id);
                div.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <h4 class="font-bold text-gray-800 flex items-center">${shop ? shop.name : 'Unknown Shop'} ${statusBadge}</h4>
                            <p class="text-xs text-gray-500 mt-1">${new Date(bill.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                        </div>
                        <div class="text-right">
                            <span class="block font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg text-sm">${utils.formatCurrency(bill.totalCost || 0)}</span>
                        </div>
                    </div>
                    <div class="text-xs text-gray-400">Bill ID: #${bill.id}</div>
                `;
                container.appendChild(div);
            }
        } catch (e) {
            console.error(e);
        }
    },

    downloadReport: async () => {
        try {
            if (!window.jspdf) return utils.toast('PDF Library not loaded', 'error');
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            const bills = await historyView.getFilteredBills();
            if (bills.length === 0) return utils.toast('No data to export', 'error');

            // Fetch shops for names
            const allShopIds = [...new Set(bills.map(b => b.shopId))];
            const { data: shopObjects } = await supaClient.from('shops').select('*').in('id', allShopIds);
            const shopMap = new Map((shopObjects || []).map(s => [s.id, s]));

            // Fetch all items for these bills
            const billIds = bills.map(b => b.id);
            const { data: allItems } = await supaClient.from('billitems').select('*').in('billId', billIds);

            // Fetch all products for names
            const allProductIds = [...new Set((allItems || []).map(i => i.productId))];
            const { data: productObjects } = await supaClient.from('products').select('*').in('id', allProductIds);
            const productMap = new Map((productObjects || []).map(p => [p.id, p]));

            // Map items by billId for easy access
            const itemsByBill = {};
            if (allItems) {
                allItems.forEach(item => {
                    if (!itemsByBill[item.billId]) itemsByBill[item.billId] = [];
                    itemsByBill[item.billId].push(item);
                });
            }

            // Header
            doc.setFontSize(18);
            doc.text("S&P Product - Sales Report (Detailed)", 105, 15, null, null, "center");

            doc.setFontSize(10);
            const dateStart = document.getElementById('history-date-start').value;
            const dateEnd = document.getElementById('history-date-end').value;
            const dateRange = dateStart || dateEnd ? `${dateStart || 'Start'} to ${dateEnd || 'End'}` : 'All Time';
            doc.text(`Period: ${dateRange}`, 14, 25);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

            // Prepare Table Body
            const body = [];
            let totalSales = 0;
            let totalCost = 0;

            bills.forEach(bill => {
                const shop = shopMap.get(bill.shopId);
                const items = itemsByBill[bill.id] || [];

                totalSales += Number(bill.totalAmount || 0);
                totalCost += Number(bill.totalCost || 0);

                // Bill Header Row
                body.push([{
                    content: `Bill #${bill.id} - ${shop ? shop.name : 'Unknown Shop'} - ${new Date(bill.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`,
                    colSpan: 4,
                    styles: { fillColor: [229, 231, 235], fontStyle: 'bold', textColor: [0, 0, 0] }
                }]);

                // Header for items
                body.push([
                    { content: 'Item', styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } },
                    { content: 'Qty', styles: { fontStyle: 'bold', halign: 'right', fillColor: [249, 250, 251] } },
                    { content: 'Price', styles: { fontStyle: 'bold', halign: 'right', fillColor: [249, 250, 251] } },
                    { content: 'Total', styles: { fontStyle: 'bold', halign: 'right', fillColor: [249, 250, 251] } }
                ]);

                // Item Rows
                items.forEach(item => {
                    const prod = productMap.get(item.productId);
                    body.push([
                        prod ? prod.name : 'Unknown Product',
                        item.quantity.toString(),
                        parseFloat(item.priceAtTime).toFixed(2),
                        (item.quantity * item.priceAtTime).toFixed(2)
                    ]);
                });

                // Bill Total Row
                body.push([
                    { content: 'Bill Total:', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
                    { content: Number(bill.totalAmount).toFixed(2), styles: { halign: 'right', fontStyle: 'bold' } }
                ]);

                // Spacer row
                body.push([{ content: '', colSpan: 4, styles: { minCellHeight: 5, fillColor: [255, 255, 255] } }]);
            });

            // Generate Table
            doc.autoTable({
                body: body,
                startY: 40,
                theme: 'grid',
                headStyles: { fillColor: [37, 99, 235] },
                columnStyles: {
                    1: { halign: 'right' },
                    2: { halign: 'right' },
                    3: { halign: 'right' }
                }
            });

            // Grand Totals Summary
            const finalY = doc.lastAutoTable.finalY + 10;
            doc.setFontSize(10);
            const totalProfit = totalSales - totalCost;

            doc.text(`Total Sales:`, 140, finalY);
            doc.text(totalSales.toFixed(2), 195, finalY, null, null, "right");

            doc.text(`Total Cost:`, 140, finalY + 5);
            doc.text(totalCost.toFixed(2), 195, finalY + 5, null, null, "right");

            doc.setFont(undefined, 'bold');
            doc.text(`Total Profit:`, 140, finalY + 12);
            doc.text(totalProfit.toFixed(2), 195, finalY + 12, null, null, "right");

            // Save
            doc.save(`Detailed_Report_${new Date().toISOString().split('T')[0]}.pdf`);
            utils.toast('Detailed report downloaded');
        } catch (e) {
            console.error(e);
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
