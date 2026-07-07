// Logic for the homepage: loads products, and handles search + category filter.

const grid = document.getElementById('product-grid');
const categoryFilter = document.getElementById('category-filter');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const resultsCount = document.getElementById('results-count');

// Read ?category= and ?search= from the URL so a shared link keeps the filter
const urlParams = new URLSearchParams(window.location.search);
let currentCategory = urlParams.get('category') || '';
let currentSearch = urlParams.get('search') || '';
searchInput.value = currentSearch;

// Fills the category dropdown with options from the backend
async function loadCategories() {
    try {
        const categories = await apiRequest('/products/categories');
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            if (category === currentCategory) option.selected = true;
            categoryFilter.appendChild(option);
        });
    } catch (err) {
        console.error(err);
    }
}

// Draws the product cards on the page
function renderProducts(products) {
    if (products.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
                <h2>No products found</h2>
                <p>Try a different search term or category.</p>
            </div>`;
        return;
    }

    grid.innerHTML = products.map(product => `
        <a class="product-card" href="product.html?id=${product.id}">
            <div class="price-tag">${money(product.price)}</div>
            <div class="product-thumb">
                <img src="${product.image_url || 'https://via.placeholder.com/400'}" alt="${product.name}" loading="lazy">
            </div>
            <div class="product-info">
                <span class="product-category">${product.category || ''}</span>
                <h3>${product.name}</h3>
                <div class="product-rating">${renderStars(product.avg_rating, product.review_count)}</div>
                <span class="product-stock ${product.stock === 0 ? 'low' : ''}">
                    ${product.stock === 0 ? 'Out of stock' : `${product.stock} in stock`}
                </span>
            </div>
        </a>
    `).join('');
}

// Fetches products from the backend using the current filters, then renders them
async function loadProducts() {
    grid.innerHTML = '<p>Loading products…</p>';

    if (isAdmin()) {
        const banner = document.getElementById('admin-banner');
        if (banner) {
            banner.style.display = 'flex';
            banner.innerHTML = `
                <span>You're browsing as an administrator — switch to a customer account to add items to cart.</span>
                <a href="admin-dashboard.html" class="btn btn-outline" style="padding:6px 14px; font-size:0.82rem;">Back to Dashboard</a>
            `;
        }
    }

    try {
        const query = new URLSearchParams();
        if (currentCategory) query.set('category', currentCategory);
        if (currentSearch) query.set('search', currentSearch);

        const products = await apiRequest(`/products?${query.toString()}`);
        resultsCount.textContent = `${products.length} product${products.length !== 1 ? 's' : ''}`;
        renderProducts(products);
    } catch (err) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
                <h2>Couldn't load products</h2>
                <p>${err.message}</p>
            </div>`;
    }
}

categoryFilter.addEventListener('change', () => {
    currentCategory = categoryFilter.value;
    loadProducts();
});

searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    currentSearch = searchInput.value.trim();
    loadProducts();
});

loadCategories();
loadProducts();