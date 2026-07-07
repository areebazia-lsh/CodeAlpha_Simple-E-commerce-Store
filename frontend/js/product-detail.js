// Logic for the product detail page: loads one product by its ?id=,
// lets the user add it to cart or wishlist, and shows/collects reviews.

const container = document.getElementById('product-detail-container');
const productId = new URLSearchParams(window.location.search).get('id');

async function loadProduct() {
    if (!productId) {
        container.innerHTML = `<div class="empty-state"><h2>No product specified</h2></div>`;
        return;
    }

    try {
        const product = await apiRequest(`/products/${productId}`);
        renderProduct(product);
        loadReviews();
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><h2>Product not found</h2><p>${err.message}</p></div>`;
    }
}

// Renders whichever media item is currently the "main" view — an image or a playable video
function renderGalleryMain(item) {
    if (!item) {
        return `<img src="https://via.placeholder.com/600" alt="No image available">`;
    }
    if (item.media_type === 'video') {
        return `<video src="${item.url}" controls playsinline></video>`;
    }
    return `<img src="${item.url}" alt="Product image">`;
}

function renderProduct(product) {
    document.title = `${product.name} — Arexon`;

    // Fall back to the single cover image if this product has no gallery entries
    // (e.g. it was created before the multi-media feature existed).
    const media = (product.media && product.media.length > 0)
        ? product.media
        : (product.image_url ? [{ media_type: 'image', url: product.image_url }] : []);

    container.innerHTML = `
        <div class="product-detail">
            <div class="product-gallery">
                <div class="gallery-main" id="gallery-main">
                    ${renderGalleryMain(media[0])}
                </div>
                ${media.length > 1 ? `
                    <div class="gallery-thumbs">
                        ${media.map((m, i) => `
                            <button type="button" class="gallery-thumb ${i === 0 ? 'active' : ''}" data-index="${i}">
                                ${m.media_type === 'video'
                                    ? `<span class="thumb-video-icon">▶</span><video src="${m.url}" muted></video>`
                                    : `<img src="${m.url}" alt="${product.name} image ${i + 1}">`}
                            </button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            <div class="product-detail-info">
                <span class="product-category">${product.category || ''}</span>
                <h1>${product.name}</h1>
                <div class="product-rating">${renderStars(product.avg_rating, product.review_count)}</div>
                <div class="product-detail-price">${money(product.price)}</div>
                <p class="product-detail-desc">${product.description || 'No description available.'}</p>
                <p class="product-stock ${product.stock === 0 ? 'low' : ''}" style="margin-bottom:18px;">
                    ${product.stock === 0 ? 'Out of stock' : `${product.stock} units available`}
                </p>

                <div class="qty-selector">
                    <button type="button" id="qty-minus" aria-label="Decrease quantity">−</button>
                    <input type="number" id="qty-input" value="1" min="1" max="${product.stock}" aria-label="Quantity">
                    <button type="button" id="qty-plus" aria-label="Increase quantity">+</button>
                </div>

                <div id="detail-alert"></div>

                <div style="display:flex; gap:10px;">
                    <button class="btn btn-accent" id="add-to-cart-btn" style="flex:1;" ${product.stock === 0 ? 'disabled' : ''}>
                        ${product.stock === 0 ? 'Out of stock' : 'Add to Cart'}
                    </button>
                    <button class="btn btn-outline wishlist-btn" id="wishlist-btn" aria-label="Save to wishlist" title="Save to wishlist">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.6z"/></svg>
                    </button>
                </div>
            </div>
        </div>

        <section class="reviews-section">
            <h2 style="font-size:1.3rem; margin-bottom:18px;">Customer Reviews</h2>
            <div id="review-form-container"></div>
            <div id="reviews-list"><p>Loading reviews…</p></div>
        </section>
    `;

    const qtyInput = document.getElementById('qty-input');

    document.querySelectorAll('.gallery-thumb').forEach(thumb => {
        thumb.addEventListener('click', () => {
            document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');
            document.getElementById('gallery-main').innerHTML = renderGalleryMain(media[parseInt(thumb.dataset.index)]);
        });
    });

    document.getElementById('qty-minus').onclick = () => {
        qtyInput.value = Math.max(1, parseInt(qtyInput.value) - 1);
    };
    document.getElementById('qty-plus').onclick = () => {
        qtyInput.value = Math.min(product.stock, parseInt(qtyInput.value) + 1);
    };

    const addToCartBtn = document.getElementById('add-to-cart-btn');
    const wishlistBtn = document.getElementById('wishlist-btn');

    if (isAdmin()) {
        addToCartBtn.disabled = true;
        addToCartBtn.textContent = 'Admins can\'t purchase';
        wishlistBtn.disabled = true;
        document.getElementById('detail-alert').innerHTML =
            `<div class="alert alert-error">You're logged in as an administrator. Log in with a customer account to buy products.</div>`;
        renderReviewForm(product.id, false);
        return;
    }

    addToCartBtn.onclick = async () => {
        if (!requireLogin()) return;

        try {
            await apiRequest('/cart', {
                method: 'POST',
                auth: true,
                body: { product_id: product.id, quantity: parseInt(qtyInput.value) }
            });
            showToast('Added to cart!', 'success');
            updateCartCount();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    wishlistBtn.onclick = async () => {
        if (!requireLogin()) return;

        try {
            await apiRequest('/wishlist', { method: 'POST', auth: true, body: { product_id: product.id } });
            wishlistBtn.classList.add('saved');
            wishlistBtn.title = 'Saved to wishlist';
            showToast('Saved to your wishlist!', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    renderReviewForm(product.id, true);
}

// ---------- Reviews ----------
function renderReviewForm(productId, canReview) {
    const formContainer = document.getElementById('review-form-container');

    if (!isLoggedIn()) {
        formContainer.innerHTML = `<p style="color:var(--ink-soft); margin-bottom:20px;"><a href="login.html" style="color:var(--accent);">Log in</a> to leave a review.</p>`;
        return;
    }
    if (!canReview) return; // admins don't review products

    formContainer.innerHTML = `
        <form id="review-form" class="review-form">
            <label style="font-size:0.85rem; font-weight:600; display:block; margin-bottom:8px;">Your Rating</label>
            <div class="star-picker" id="star-picker">
                ${[1, 2, 3, 4, 5].map(n => `
                    <button type="button" class="star-pick" data-value="${n}" aria-label="${n} star">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15 9 22 9 16.5 13.5 18.5 21 12 16.5 5.5 21 7.5 13.5 2 9 9 9"/></svg>
                    </button>
                `).join('')}
            </div>
            <div class="form-group">
                <textarea id="review-comment" rows="3" placeholder="Share your thoughts about this product (optional)"></textarea>
            </div>
            <div id="review-alert"></div>
            <button type="submit" class="btn btn-accent">Submit Review</button>
        </form>
    `;

    let selectedRating = 0;
    const starButtons = document.querySelectorAll('.star-pick');
    starButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedRating = parseInt(btn.dataset.value);
            starButtons.forEach(b => b.classList.toggle('active', parseInt(b.dataset.value) <= selectedRating));
        });
    });

    document.getElementById('review-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const alertBox = document.getElementById('review-alert');

        if (!selectedRating) {
            alertBox.innerHTML = `<div class="alert alert-error">Please select a star rating.</div>`;
            return;
        }

        try {
            await apiRequest(`/reviews/${productId}`, {
                method: 'POST',
                auth: true,
                body: { rating: selectedRating, comment: document.getElementById('review-comment').value.trim() }
            });
            alertBox.innerHTML = `<div class="alert alert-success">Thanks for your review!</div>`;
            loadReviews();
            loadProduct(); // refresh average rating shown above
        } catch (err) {
            alertBox.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        }
    });
}

async function loadReviews() {
    const listEl = document.getElementById('reviews-list');
    if (!listEl) return;

    try {
        const reviews = await apiRequest(`/reviews/${productId}`);
        if (reviews.length === 0) {
            listEl.innerHTML = `<p style="color:var(--ink-soft);">No reviews yet — be the first to share your thoughts.</p>`;
            return;
        }

        listEl.innerHTML = reviews.map(review => `
            <div class="review-card">
                <div class="review-card-header">
                    <strong>${review.reviewer_name}</strong>
                    <span style="color:var(--ink-soft); font-size:0.8rem;">${new Date(review.created_at).toLocaleDateString()}</span>
                </div>
                <div class="stars-row">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
                ${review.comment ? `<p style="margin-top:8px;">${review.comment}</p>` : ''}
            </div>
        `).join('');
    } catch (err) {
        listEl.innerHTML = `<p style="color:var(--danger);">Couldn't load reviews: ${err.message}</p>`;
    }
}

loadProduct();