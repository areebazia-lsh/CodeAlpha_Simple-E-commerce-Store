// Logic for the order history page: animated order cards with item
// thumbnails, shipping/payment info, and a cancel option for pending orders.

const ordersContainer = document.getElementById('orders-container');
const successOrderId = new URLSearchParams(window.location.search).get('success');

async function loadOrders() {
    if (!requireLogin()) return;

    if (successOrderId) {
        showToast(`Order #${successOrderId} placed successfully!`, 'success');
    }

    try {
        const orders = await apiRequest('/orders', { auth: true });
        renderOrders(orders);
    } catch (err) {
        ordersContainer.innerHTML = `<div class="empty-state"><h2>Couldn't load orders</h2><p>${err.message}</p></div>`;
    }
}

function paymentLabel(method) {
    return method === 'card' ? 'Card' : 'Cash on Delivery';
}

function renderOrders(orders) {
    // If we just arrived here from a successful checkout, show a banner
    let banner = '';
    if (successOrderId) {
        banner = `<div class="alert alert-success">Order #${successOrderId} placed successfully! Thank you for shopping with us.</div>`;
    }

    if (orders.length === 0) {
        ordersContainer.innerHTML = banner + `
            <div class="empty-state">
                <h2>No orders yet</h2>
                <p>Your placed orders will show up here.</p>
                <br>
                <a class="btn btn-primary" href="shop.html">Start Shopping</a>
            </div>`;
        return;
    }

    ordersContainer.innerHTML = banner + orders.map((order, index) => `
        <div class="order-card" style="animation-delay:${index * 0.05}s;">
            <div class="order-card-header">
                <div>
                    <strong>Order #${order.id}</strong>
                    <div style="font-size:0.85rem; color:var(--ink-soft);">
                        ${new Date(order.created_at).toLocaleString()} · ${paymentLabel(order.payment_method)}
                    </div>
                </div>
                <span class="order-status status-${order.status}">${order.status}</span>
            </div>

            <div class="order-item-thumbs">
                ${order.items.map(item => `
                    <div class="order-item-thumb">
                        <img src="${item.image_url || 'https://via.placeholder.com/40'}" alt="${item.product_name}">
                        <span>${item.product_name} <span class="qty">× ${item.quantity}</span></span>
                    </div>
                `).join('')}
            </div>

            <div class="order-item-row" style="font-weight:700; color:var(--ink); border-top:1px solid var(--border); padding-top:10px;">
                <span>Total</span>
                <span>${money(order.total_amount)}</span>
            </div>

            <div class="order-footer">
                <span style="font-size:0.82rem; color:var(--ink-soft);">
                    Shipping to: ${order.shipping_address || '—'}${order.city ? ', ' + order.city : ''}
                </span>
                ${order.status === 'pending' ? `<button class="btn btn-danger cancel-btn" data-id="${order.id}">Cancel Order</button>` : ''}
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.cancel-btn').forEach(btn => {
        btn.onclick = () => cancelOrder(btn.dataset.id);
    });
}

async function cancelOrder(orderId) {
    if (!confirm('Cancel this order? This cannot be undone.')) return;

    try {
        await apiRequest(`/orders/${orderId}/cancel`, { method: 'PUT', auth: true });
        showToast('Order cancelled.', 'success');
        loadOrders();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

loadOrders();