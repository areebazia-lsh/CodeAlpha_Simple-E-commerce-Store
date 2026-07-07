// Logic for the checkout page: shows an order summary, collects shipping
// details, lets the customer pick Cash on Delivery or Card, and places the order.
//
// Note on payment: this is a student/demo project, so "Card" doesn't connect
// to a real payment processor (that needs a merchant account and API keys).
// Card fields are shown for a realistic flow, but nothing about them is sent
// to the server or stored anywhere — only the chosen payment_method is saved.

if (!requireLogin()) {
    throw new Error('Not logged in — redirecting.');
}

if (isAdmin()) {
    document.querySelector('main').innerHTML = `
        <div class="empty-state">
            <h2>Admin accounts don't shop</h2>
            <p>Log in with a customer account to check out.</p>
        </div>`;
    throw new Error('Admin account — checkout not available.');
}

const summaryBox = document.getElementById('order-summary');
const formAlert = document.getElementById('form-alert');
let cartTotal = 0;

// Item IDs the user picked on the cart page (via checkboxes). If this is
// missing (e.g. someone opens checkout.html directly), we fall back to the
// whole cart so nothing breaks.
let selectedItemIds = null;
try {
    const stored = sessionStorage.getItem('checkout_item_ids');
    if (stored) selectedItemIds = JSON.parse(stored);
} catch (e) {
    selectedItemIds = null;
}

async function loadSummary() {
    try {
        const cart = await apiRequest('/cart', { auth: true });

        if (cart.items.length === 0) {
            summaryBox.innerHTML = `Your cart is empty. <a href="shop.html" style="color:var(--accent);">Go shopping →</a>`;
            document.getElementById('submit-btn').disabled = true;
            return;
        }

        // Only show/charge for the items selected on the cart page.
        const itemsToOrder = selectedItemIds
            ? cart.items.filter(item => selectedItemIds.includes(String(item.id)))
            : cart.items;

        if (itemsToOrder.length === 0) {
            summaryBox.innerHTML = `No items selected. <a href="cart.html" style="color:var(--accent);">Go back to cart →</a>`;
            document.getElementById('submit-btn').disabled = true;
            return;
        }

        cartTotal = itemsToOrder.reduce((sum, item) => sum + item.price * item.quantity, 0);

        summaryBox.innerHTML = itemsToOrder.map(item => `
            <div class="row"><span>${item.name} × ${item.quantity}</span><span>${money(item.price * item.quantity)}</span></div>
        `).join('') + `
            <div class="row total"><span>Total</span><span>${money(cartTotal)}</span></div>
        `;
    } catch (err) {
        summaryBox.innerHTML = `<span style="color:var(--danger);">Couldn't load your cart: ${err.message}</span>`;
    }
}

// ---------- Payment method toggle ----------
const codOption = document.getElementById('option-cod');
const cardOption = document.getElementById('option-card');
const cardFields = document.getElementById('card-fields');

function selectPayment(method) {
    codOption.classList.toggle('selected', method === 'cod');
    cardOption.classList.toggle('selected', method === 'card');
    cardFields.classList.toggle('visible', method === 'card');
}

codOption.addEventListener('click', () => selectPayment('cod'));
cardOption.addEventListener('click', () => selectPayment('card'));

// ---------- Place order ----------
document.getElementById('checkout-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const button = document.getElementById('submit-btn');
    const selectedPayment = document.querySelector('input[name="payment"]:checked').value;

    if (selectedPayment === 'card') {
        const number = document.getElementById('card-number').value.trim();
        const expiry = document.getElementById('card-expiry').value.trim();
        const cvv = document.getElementById('card-cvv').value.trim();
        if (!number || !expiry || !cvv) {
            formAlert.innerHTML = `<div class="alert alert-error">Please fill in all card details.</div>`;
            return;
        }
    }

    button.disabled = true;
    button.textContent = 'Placing order…';

    try {
        const result = await apiRequest('/orders', {
            method: 'POST',
            auth: true,
            body: {
                full_name: document.getElementById('full-name').value.trim(),
                phone: document.getElementById('phone').value.trim(),
                shipping_address: document.getElementById('address').value.trim(),
                city: document.getElementById('city').value.trim(),
                payment_method: selectedPayment,
                item_ids: selectedItemIds || undefined
            }
        });
        sessionStorage.removeItem('checkout_item_ids');
        window.location.href = `orders.html?success=${result.order_id}`;
    } catch (err) {
        formAlert.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        button.disabled = false;
        button.textContent = 'Place Order';
    }
});

// Pre-fill name from the logged-in account, since we already know it
const currentUser = getUser();
if (currentUser) document.getElementById('full-name').value = currentUser.name;

loadSummary();