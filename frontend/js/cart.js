// Logic for the cart page: shows items, lets the user change quantities,
// remove items, select/deselect individual items, and checkout with just
// the selected ones (like Amazon's cart, where you pick which items to
// actually buy right now and leave the rest sitting in the cart).

const cartContainer = document.getElementById('cart-container');

// Which cart item IDs (strings) are currently checked for checkout.
// Kept outside renderCart() so selections survive a qty update / re-render.
let selectedIds = new Set();
let latestCart = null;

async function loadCart() {
    if (!requireLogin()) return;

    if (isAdmin()) {
        cartContainer.innerHTML = `
            <div class="empty-state">
                <h2>Admin accounts don't shop</h2>
                <p>You're logged in as an administrator. Log in with a customer account to use the cart.</p>
                <br>
                <a class="btn btn-primary" href="admin-dashboard.html">Back to Dashboard</a>
            </div>`;
        return;
    }

    try {
        const cart = await apiRequest('/cart', { auth: true });
        latestCart = cart;

        // New items (just added elsewhere) default to selected.
        // Items that were removed from the cart drop out of the set automatically.
        const currentIds = new Set(cart.items.map(item => String(item.id)));
        if (selectedIds.size === 0) {
            selectedIds = currentIds; // first load: everything selected, like a normal cart
        } else {
            for (const id of currentIds) {
                if (!selectedIds.has(id) && !everSeenIds.has(id)) selectedIds.add(id);
            }
        }
        currentIds.forEach(id => everSeenIds.add(id));

        renderCart(cart);
    } catch (err) {
        cartContainer.innerHTML = `<div class="empty-state"><h2>Couldn't load cart</h2><p>${err.message}</p></div>`;
    }
}

// Tracks every item id we've ever rendered, so we only auto-select *newly
// appeared* items and don't accidentally re-select something the user
// deliberately unchecked earlier in this session.
const everSeenIds = new Set();

function renderCart(cart) {
    if (cart.items.length === 0) {
        cartContainer.innerHTML = `
            <div class="empty-state">
                <h2>Your cart is empty</h2>
                <p>Browse products and add something you like.</p>
                <br>
                <a class="btn btn-primary" href="shop.html">Continue Shopping</a>
            </div>`;
        return;
    }

    const allSelected = cart.items.every(item => selectedIds.has(String(item.id)));

    const itemsHtml = cart.items.map(item => {
        const checked = selectedIds.has(String(item.id));
        return `
        <div class="cart-item" data-item-id="${item.id}">
            <input type="checkbox" class="item-select" aria-label="Select ${item.name} for checkout" ${checked ? 'checked' : ''}>
            <img src="${item.image_url || 'https://via.placeholder.com/80'}" alt="${item.name}">
            <div>
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">${money(item.price)} each</div>
            </div>
            <div class="qty-selector">
                <button type="button" class="qty-minus" aria-label="Decrease quantity">−</button>
                <input type="number" class="qty-input" value="${item.quantity}" min="1" max="${item.stock}" aria-label="Quantity">
                <button type="button" class="qty-plus" aria-label="Increase quantity">+</button>
            </div>
            <div style="font-weight:600;">${money(item.price * item.quantity)}</div>
            <button class="btn btn-danger remove-btn" aria-label="Remove item">Remove</button>
        </div>
    `;
    }).join('');

    cartContainer.innerHTML = `
        <div class="cart-select-all">
            <label>
                <input type="checkbox" id="select-all" ${allSelected ? 'checked' : ''}>
                Select all
            </label>
        </div>
        <div>${itemsHtml}</div>
        <div class="cart-summary">
            <div class="cart-summary-row"><span id="selected-count-label">Subtotal</span><span id="summary-subtotal">${money(0)}</span></div>
            <div class="cart-summary-row"><span>Shipping</span><span>Free</span></div>
            <div class="cart-summary-row cart-summary-total"><span>Total</span><span id="summary-total">${money(0)}</span></div>
            <button class="btn btn-accent btn-block" id="checkout-btn" style="margin-top:16px;">Proceed to Checkout</button>
        </div>
    `;

    attachCartEvents();
    updateSummary();
}

// Recomputes the subtotal/total shown in the summary box from only the
// currently-selected items, and keeps the Select all checkbox in sync.
function updateSummary() {
    if (!latestCart) return;

    const selectedItems = latestCart.items.filter(item => selectedIds.has(String(item.id)));
    const subtotal = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const count = selectedItems.length;

    const label = document.getElementById('selected-count-label');
    if (label) label.textContent = count === latestCart.items.length ? 'Subtotal' : `Subtotal (${count} item${count === 1 ? '' : 's'})`;

    const subtotalEl = document.getElementById('summary-subtotal');
    const totalEl = document.getElementById('summary-total');
    if (subtotalEl) subtotalEl.textContent = money(subtotal);
    if (totalEl) totalEl.textContent = money(subtotal);

    const selectAllBox = document.getElementById('select-all');
    if (selectAllBox) selectAllBox.checked = count === latestCart.items.length && count > 0;

    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) checkoutBtn.disabled = count === 0;
}

// Wires up the checkbox, +/- buttons, quantity input, and remove button for each row
function attachCartEvents() {
    document.querySelectorAll('.cart-item').forEach(row => {
        const itemId = row.dataset.itemId;
        const qtyInput = row.querySelector('.qty-input');
        const stockLimit = parseInt(qtyInput.max);

        row.querySelector('.item-select').onchange = (e) => {
            if (e.target.checked) selectedIds.add(itemId);
            else selectedIds.delete(itemId);
            updateSummary();
        };

        row.querySelector('.qty-minus').onclick = () => updateQty(itemId, Math.max(1, parseInt(qtyInput.value) - 1));
        row.querySelector('.qty-plus').onclick = () => updateQty(itemId, Math.min(stockLimit, parseInt(qtyInput.value) + 1));
        qtyInput.onchange = () => updateQty(itemId, Math.min(stockLimit, Math.max(1, parseInt(qtyInput.value) || 1)));
        row.querySelector('.remove-btn').onclick = () => removeItem(itemId);
    });

    const selectAllBox = document.getElementById('select-all');
    if (selectAllBox) {
        selectAllBox.onchange = (e) => {
            if (e.target.checked) {
                latestCart.items.forEach(item => selectedIds.add(String(item.id)));
            } else {
                selectedIds.clear();
            }
            document.querySelectorAll('.item-select').forEach(box => box.checked = e.target.checked);
            updateSummary();
        };
    }

    document.getElementById('checkout-btn').onclick = () => {
        if (selectedIds.size === 0) {
            showToast('Select at least one item to checkout.', 'error');
            return;
        }
        // Pass the chosen item IDs to the checkout page via sessionStorage
        // so checkout only bills and orders these items, leaving the rest in the cart.
        sessionStorage.setItem('checkout_item_ids', JSON.stringify(Array.from(selectedIds)));
        window.location.href = 'checkout.html';
    };
}

async function updateQty(itemId, quantity) {
    try {
        await apiRequest(`/cart/${itemId}`, { method: 'PUT', auth: true, body: { quantity } });
        loadCart();
        updateCartCount();
    } catch (err) {
        showToast(err.message, 'error');
        loadCart(); // reset the input back to the real saved quantity, since the typed value was rejected
    }
}

async function removeItem(itemId) {
    try {
        await apiRequest(`/cart/${itemId}`, { method: 'DELETE', auth: true });
        showToast('Item removed from cart.', 'success');
        loadCart();
        updateCartCount();
    } catch (err) {
        showToast(err.message, 'error');
    }
}


loadCart();