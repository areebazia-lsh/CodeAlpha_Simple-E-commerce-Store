// Logic for the wishlist page: shows saved products as cards, lets the
// customer remove them or move them straight into the cart.

const wishlistGrid = document.getElementById('wishlist-grid');

async function loadWishlist() {
    if (!requireLogin()) return;

    if (isAdmin()) {
        wishlistGrid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
                <h2>Admin accounts don't have a wishlist</h2>
                <p>Log in with a customer account to save products.</p>
            </div>`;
        return;
    }

    try {
        const items = await apiRequest('/wishlist', { auth: true });
        renderWishlist(items);
    } catch (err) {
        wishlistGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><h2>Couldn't load wishlist</h2><p>${err.message}</p></div>`;
    }
}

function renderWishlist(items) {
    if (items.length === 0) {
        wishlistGrid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
                <h2>Your wishlist is empty</h2>
                <p>Tap the heart icon on any product to save it here.</p>
                <br>
                <a class="btn btn-primary" href="shop.html">Browse Products</a>
            </div>`;
        return;
    }

    wishlistGrid.innerHTML = items.map(product => `
        <div class="product-card">
            <div class="price-tag">${money(product.price)}</div>
            <a href="product.html?id=${product.id}" class="product-thumb">
                <img src="${product.image_url || 'https://via.placeholder.com/400'}" alt="${product.name}" loading="lazy">
            </a>
            <div class="product-info">
                <span class="product-category">${product.category || ''}</span>
                <h3><a href="product.html?id=${product.id}">${product.name}</a></h3>
                <div style="display:flex; gap:8px; margin-top:8px;">
                    <button class="btn btn-accent add-btn" data-id="${product.id}" style="flex:1; padding:8px; font-size:0.82rem;" ${product.stock === 0 ? 'disabled' : ''}>
                        ${product.stock === 0 ? 'Out of stock' : 'Add to Cart'}
                    </button>
                    <button class="icon-btn danger remove-btn" data-id="${product.id}" aria-label="Remove from wishlist" title="Remove">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    wishlistGrid.querySelectorAll('.add-btn').forEach(btn => {
        btn.onclick = () => addToCartFromWishlist(btn.dataset.id);
    });
    wishlistGrid.querySelectorAll('.remove-btn').forEach(btn => {
        btn.onclick = () => removeFromWishlist(btn.dataset.id);
    });
}

async function addToCartFromWishlist(productId) {
    try {
        await apiRequest('/cart', { method: 'POST', auth: true, body: { product_id: productId, quantity: 1 } });
        updateCartCount();
        showToast('Added to cart!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function removeFromWishlist(productId) {
    try {
        await apiRequest(`/wishlist/${productId}`, { method: 'DELETE', auth: true });
        showToast('Removed from wishlist.', 'success');
        loadWishlist();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

loadWishlist();