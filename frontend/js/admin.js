// Logic for the admin dashboard: tab switching, product CRUD, and order status updates.
// This page is only reachable by logged-in users with role "admin" (see requireAdmin()).

if (!requireAdmin()) {
    // requireAdmin() already redirected to admin-login.html
    throw new Error('Not an admin — redirecting.');
}

const user = getUser();
document.getElementById('admin-greeting').textContent = `Hi, ${user.name.split(' ')[0]}`;
document.getElementById('logout-btn').onclick = () => {
    clearSession();
    window.location.href = 'index.html';
};

// ---------- Tab switching ----------
const tabButtons = document.querySelectorAll('.admin-tab');
const tabProducts = document.getElementById('tab-products');
const tabOrders = document.getElementById('tab-orders');
const tabAnalytics = document.getElementById('tab-analytics');

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        button.classList.add('active');

        tabProducts.hidden = button.dataset.tab !== 'products';
        tabOrders.hidden = button.dataset.tab !== 'orders';
        tabAnalytics.hidden = button.dataset.tab !== 'analytics';

        if (button.dataset.tab === 'orders') loadOrders();
        if (button.dataset.tab === 'analytics') loadAnalytics();
    });
});

// ---------- Product management ----------
const productForm = document.getElementById('product-form');
const productIdField = document.getElementById('product-id');
const productSubmitBtn = document.getElementById('product-submit-btn');
const productCancelBtn = document.getElementById('product-cancel-btn');
const productFormAlert = document.getElementById('product-form-alert');
const productsGrid = document.getElementById('products-grid');
const mediaRowsContainer = document.getElementById('media-rows');

// ---------- Dynamic media rows (add as many images/videos as wanted) ----------
function addMediaRow(type = 'image', url = '') {
    const row = document.createElement('div');
    row.className = 'media-row';
    row.innerHTML = `
        <select class="media-type-select">
            <option value="image" ${type === 'image' ? 'selected' : ''}>Image</option>
            <option value="video" ${type === 'video' ? 'selected' : ''}>Video</option>
        </select>
        <input type="text" class="media-url-input" placeholder="Paste a URL, or upload a file →" value="${url.replace(/"/g, '&quot;')}">
        <label class="btn btn-outline upload-btn">
            <span class="upload-btn-text">Upload</span>
            <input type="file" class="media-file-input" accept="image/*,video/*" hidden>
        </label>
        <button type="button" class="icon-btn danger remove-media-btn" aria-label="Remove this media item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
    `;

    const urlInput = row.querySelector('.media-url-input');
    const typeSelect = row.querySelector('.media-type-select');
    const fileInput = row.querySelector('.media-file-input');
    const uploadLabel = row.querySelector('.upload-btn');

    // Uploading a file from the device (phone gallery, computer, etc.) instead of pasting a link
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) return;

        const originalText = uploadLabel.querySelector('.upload-btn-text').textContent;
        uploadLabel.querySelector('.upload-btn-text').textContent = 'Uploading…';
        uploadLabel.style.pointerEvents = 'none';

        try {
            const result = await uploadMediaFile(file);
            urlInput.value = result.url;
            typeSelect.value = result.type;
            showToast('File uploaded.', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            uploadLabel.querySelector('.upload-btn-text').textContent = originalText;
            uploadLabel.style.pointerEvents = '';
            fileInput.value = '';
        }
    });

    row.querySelector('.remove-media-btn').onclick = () => row.remove();
    mediaRowsContainer.appendChild(row);
}

// Uploads one file to the server and returns { url, type }
async function uploadMediaFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/admin/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
        body: formData
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || 'Upload failed.');
    }
    return data;
}

document.getElementById('add-media-btn').addEventListener('click', () => addMediaRow());

function getMediaRows() {
    return Array.from(mediaRowsContainer.querySelectorAll('.media-row'))
        .map(row => ({
            type: row.querySelector('.media-type-select').value,
            url: row.querySelector('.media-url-input').value.trim()
        }))
        .filter(m => m.url);
}

function clearMediaRows() {
    mediaRowsContainer.innerHTML = '';
}

function getProductFormValues() {
    return {
        name: document.getElementById('p-name').value.trim(),
        price: parseFloat(document.getElementById('p-price').value),
        category: document.getElementById('p-category').value.trim(),
        stock: parseInt(document.getElementById('p-stock').value) || 0,
        description: document.getElementById('p-description').value.trim(),
        media: getMediaRows()
    };
}

async function fillProductForm(productSummary) {
    // The products list doesn't include the media gallery, so fetch the full
    // product detail (which does) before populating the edit form.
    let product = productSummary;
    try {
        product = await apiRequest(`/products/${productSummary.id}`);
    } catch (err) {
        // fall back to the summary version if this fails — better than nothing
    }

    productIdField.value = product.id;
    document.getElementById('p-name').value = product.name;
    document.getElementById('p-price').value = product.price;
    document.getElementById('p-category').value = product.category || '';
    document.getElementById('p-stock').value = product.stock;
    document.getElementById('p-description').value = product.description || '';

    clearMediaRows();
    if (product.media && product.media.length > 0) {
        product.media.forEach(m => addMediaRow(m.media_type, m.url));
    } else if (product.image_url) {
        addMediaRow('image', product.image_url); // older product saved before the media feature existed
    } else {
        addMediaRow();
    }

    productSubmitBtn.textContent = 'Update Product';
    productCancelBtn.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetProductForm() {
    productForm.reset();
    productIdField.value = '';
    clearMediaRows();
    addMediaRow(); // always leave one empty row ready to fill in
    productSubmitBtn.textContent = 'Add Product';
    productCancelBtn.hidden = true;
}

productCancelBtn.onclick = resetProductForm;

productForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = getProductFormValues();
    const editingId = productIdField.value;

    productSubmitBtn.disabled = true;

    try {
        if (editingId) {
            await apiRequest(`/admin/products/${editingId}`, { method: 'PUT', auth: true, body: values });
        } else {
            await apiRequest('/admin/products', { method: 'POST', auth: true, body: values });
        }
        productFormAlert.innerHTML = `<div class="alert alert-success">Product ${editingId ? 'updated' : 'added'}.</div>`;
        resetProductForm();
        loadProducts();
    } catch (err) {
        productFormAlert.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    } finally {
        productSubmitBtn.disabled = false;
    }
});

// Start with one empty media row ready to go
addMediaRow();

async function loadProducts() {
    try {
        const products = await apiRequest('/products');
        renderLowStockBanner(products);
        renderProductsGrid(products);
    } catch (err) {
        productsGrid.innerHTML = `<p>Couldn't load products: ${err.message}</p>`;
    }
}

function renderLowStockBanner(products) {
    const banner = document.getElementById('low-stock-banner');
    const lowStock = products.filter(p => p.stock <= 10).sort((a, b) => a.stock - b.stock);

    if (lowStock.length === 0) {
        banner.innerHTML = '';
        return;
    }

    banner.innerHTML = `
        <div class="low-stock-banner">
            <div class="low-stock-header">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
                <strong>${lowStock.length} product${lowStock.length > 1 ? 's are' : ' is'} running low on stock</strong>
            </div>
            <div class="low-stock-chips">
                ${lowStock.map(p => `<span class="low-stock-chip">${p.name} — ${p.stock === 0 ? 'Out of stock' : `${p.stock} left`}</span>`).join('')}
            </div>
        </div>
    `;
}

function renderProductsGrid(products) {
    if (products.length === 0) {
        productsGrid.innerHTML = `<p>No products yet. Add your first one above.</p>`;
        return;
    }

    productsGrid.innerHTML = products.map((p, index) => `
        <div class="admin-product-card" style="animation-delay:${index * 0.04}s;">
            <div class="thumb">
                <img src="${p.image_url || 'https://via.placeholder.com/300'}" alt="${p.name}">
            </div>
            <div class="body">
                <h4>${p.name}</h4>
                <div class="meta">
                    <span>${p.category || '—'}</span>
                    <span class="price">${money(p.price)}</span>
                </div>
                <div class="meta">
                    <span>Stock: ${p.stock}</span>
                </div>
                <div class="actions">
                    <button class="btn btn-outline edit-btn" data-id="${p.id}">Edit</button>
                    <button class="btn btn-danger delete-btn" data-id="${p.id}">Delete</button>
                </div>
            </div>
        </div>
    `).join('');

    productsGrid.querySelectorAll('.edit-btn').forEach(btn => {
        btn.onclick = () => {
            const product = products.find(p => p.id === parseInt(btn.dataset.id));
            if (product) fillProductForm(product);
        };
    });

    productsGrid.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = () => deleteProduct(btn.dataset.id);
    });
}

async function deleteProduct(id) {
    if (!confirm('Delete this product? This cannot be undone.')) return;

    try {
        await apiRequest(`/admin/products/${id}`, { method: 'DELETE', auth: true });
        loadProducts();
    } catch (err) {
        alert(err.message);
    }
}

// ---------- Order management ----------
const ordersList = document.getElementById('orders-list');

async function loadOrders() {
    ordersList.innerHTML = `<p>Loading orders…</p>`;
    try {
        const orders = await apiRequest('/admin/orders', { auth: true });
        renderOrdersList(orders);
    } catch (err) {
        ordersList.innerHTML = `<p>Couldn't load orders: ${err.message}</p>`;
    }
}

function renderOrdersList(orders) {
    if (orders.length === 0) {
        ordersList.innerHTML = `<p>No orders placed yet.</p>`;
        return;
    }

    ordersList.innerHTML = orders.map((order, index) => `
        <div class="admin-order-card" style="animation-delay:${index * 0.04}s;">
            <div class="header">
                <div>
                    <strong>Order #${order.id}</strong>
                    <div class="customer">${order.customer_name} · ${order.customer_email}</div>
                </div>
                <select class="status-select" data-id="${order.id}">
                    <option value="pending"   ${order.status === 'pending'   ? 'selected' : ''}>Pending</option>
                    <option value="shipped"   ${order.status === 'shipped'   ? 'selected' : ''}>Shipped</option>
                    <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                    <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </div>
            <div class="order-item-thumbs">
                ${order.items.map(item => `
                    <div class="order-item-thumb">
                        <img src="${item.image_url || 'https://via.placeholder.com/40'}" alt="${item.product_name}">
                        <span>${item.product_name} <span class="qty">× ${item.quantity}</span></span>
                    </div>
                `).join('')}
            </div>
            <div class="order-item-row" style="font-weight:700; color:var(--ink);">
                <span>${order.shipping_address || '—'}${order.city ? ', ' + order.city : ''}</span>
                <span>${money(order.total_amount)}</span>
            </div>
        </div>
    `).join('');

    ordersList.querySelectorAll('.status-select').forEach(select => {
        select.addEventListener('change', () => updateOrderStatus(select.dataset.id, select.value));
    });
}

async function updateOrderStatus(orderId, status) {
    try {
        await apiRequest(`/admin/orders/${orderId}/status`, { method: 'PUT', auth: true, body: { status } });
    } catch (err) {
        alert(err.message);
        loadOrders(); // revert the dropdown to the real status
    }
}

loadProducts();

// ---------- Analytics ----------
const analyticsContent = document.getElementById('analytics-content');

async function loadAnalytics() {
    analyticsContent.innerHTML = `<p>Loading analytics…</p>`;
    try {
        const data = await apiRequest('/admin/analytics', { auth: true });
        renderAnalytics(data);
    } catch (err) {
        analyticsContent.innerHTML = `<p>Couldn't load analytics: ${err.message}</p>`;
    }
}

function renderAnalytics(data) {
    const maxDailyRevenue = Math.max(...data.daily_revenue.map(d => d.revenue), 1);
    const maxTopProductUnits = Math.max(...data.top_products.map(p => p.units_sold), 1);

    analyticsContent.innerHTML = `
        <div class="stat-cards">
            <div class="stat-card">
                <span class="stat-label">Total Revenue</span>
                <span class="stat-value">${money(data.total_revenue)}</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Orders Placed</span>
                <span class="stat-value">${data.order_count}</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Registered Customers</span>
                <span class="stat-value">${data.customer_count}</span>
            </div>
        </div>

        <div class="analytics-grid">
            <div class="analytics-panel">
                <h3>Revenue — Last 7 Days</h3>
                <div class="bar-chart">
                    ${data.daily_revenue.map(d => `
                        <div class="bar-col">
                            <div class="bar" style="height:${Math.max((d.revenue / maxDailyRevenue) * 100, 3)}%;" title="${money(d.revenue)}"></div>
                            <span class="bar-label">${new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="analytics-panel">
                <h3>Best-Selling Products</h3>
                ${data.top_products.length === 0 ? '<p style="color:var(--ink-soft);">No sales yet.</p>' : data.top_products.map(p => `
                    <div class="top-product-row">
                        <span class="top-product-name">${p.product_name}</span>
                        <div class="top-product-bar-track">
                            <div class="top-product-bar" style="width:${(p.units_sold / maxTopProductUnits) * 100}%;"></div>
                        </div>
                        <span class="top-product-units">${p.units_sold} sold</span>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="analytics-panel" style="margin-top:24px;">
            <h3>Low Stock (10 or fewer left)</h3>
            ${data.low_stock.length === 0 ? '<p style="color:var(--ink-soft);">Everything is well stocked.</p>' : `
                <div class="admin-card-grid">
                    ${data.low_stock.map(p => `
                        <div class="admin-product-card">
                            <div class="thumb"><img src="${p.image_url || 'https://via.placeholder.com/300'}" alt="${p.name}"></div>
                            <div class="body">
                                <h4>${p.name}</h4>
                                <div class="meta"><span class="${p.stock === 0 ? 'stock-critical' : 'stock-warning'}">${p.stock === 0 ? 'Out of stock' : `${p.stock} left`}</span></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
    `;
}