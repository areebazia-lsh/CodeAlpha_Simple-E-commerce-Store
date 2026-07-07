// Shared helpers used by every page: talking to the backend API,
// remembering the logged-in user, rendering the header nav, and
// the password show/hide toggle used on the auth forms.

const API_BASE = '/api';

// Wrapper around fetch(): adds the JSON header, attaches the login
// token when needed, and throws a readable error message on failure.
async function apiRequest(path, { method = 'GET', body, auth = false } = {}) {
    const headers = { 'Content-Type': 'application/json' };

    if (auth) {
        const token = localStorage.getItem('token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
    }
    return data;
}

// ---------- Login state helpers ----------
// The token + user are kept in localStorage so the user stays
// logged in even after closing and reopening the browser tab.

function getToken() {
    return localStorage.getItem('token');
}

function getUser() {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
}

function isLoggedIn() {
    return !!getToken();
}

function isAdmin() {
    const user = getUser();
    return !!user && user.role === 'admin';
}

function saveSession(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
}

function clearSession() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}

// Redirects to the customer login page if nobody is logged in.
// Returns true/false so the calling page can stop what it was doing.
function requireLogin() {
    if (!isLoggedIn()) {
        const redirectTo = window.location.pathname + window.location.search;
        window.location.href = `login.html?redirect=${encodeURIComponent(redirectTo)}`;
        return false;
    }
    return true;
}

// Same idea, but for admin-only pages — sends non-admins to the admin login page.
function requireAdmin() {
    if (!isLoggedIn() || !isAdmin()) {
        window.location.href = 'admin-login.html';
        return false;
    }
    return true;
}

// ---------- Header / navigation ----------
// Customer-facing pages have <nav id="nav-right"></nav> in their header.
// This fills it in with the right links depending on login state / role.

function renderNav() {
    const navRight = document.getElementById('nav-right');
    if (!navRight) return;

    const user = getUser();
    navRight.innerHTML = '';

    if (user && user.role === 'admin') {
        // An admin looking at the customer storefront — send them back to their own dashboard
        const homeLink = document.createElement('a');
        homeLink.href = 'shop.html';
        homeLink.textContent = 'Home';
        navRight.appendChild(homeLink);

        const dashLink = document.createElement('a');
        dashLink.href = 'admin-dashboard.html';
        dashLink.textContent = 'Admin Dashboard';
        navRight.appendChild(dashLink);

        const logoutBtn = document.createElement('button');
        logoutBtn.textContent = 'Logout';
        logoutBtn.onclick = () => { clearSession(); window.location.href = 'index.html'; };
        navRight.appendChild(logoutBtn);
        return;
    }

    const cartLink = document.createElement('a');
    cartLink.href = 'cart.html';
    cartLink.className = 'cart-link';
    cartLink.innerHTML = `Cart <span class="cart-count" id="cart-count" hidden>0</span>`;

    const homeLink = document.createElement('a');
    homeLink.href = 'shop.html';
    homeLink.textContent = 'Home';
    navRight.appendChild(homeLink);

    navRight.appendChild(cartLink);

    const wishlistLink = document.createElement('a');
    wishlistLink.href = 'wishlist.html';
    wishlistLink.textContent = 'Wishlist';
    navRight.appendChild(wishlistLink);

    if (user) {
        const ordersLink = document.createElement('a');
        ordersLink.href = 'orders.html';
        ordersLink.textContent = 'My Orders';
        navRight.appendChild(ordersLink);

        const greeting = document.createElement('span');
        greeting.className = 'nav-greeting';
        greeting.textContent = `Hi, ${user.name.split(' ')[0]}`;
        navRight.appendChild(greeting);

        const logoutBtn = document.createElement('button');
        logoutBtn.textContent = 'Logout';
        logoutBtn.onclick = () => {
            clearSession();
            window.location.href = 'index.html';
        };
        navRight.appendChild(logoutBtn);
    } else {
        const loginLink = document.createElement('a');
        loginLink.href = 'login.html';
        loginLink.textContent = 'Login';
        navRight.appendChild(loginLink);

        const registerLink = document.createElement('a');
        registerLink.href = 'register.html';
        registerLink.textContent = 'Sign Up';
        navRight.appendChild(registerLink);
    }

    updateCartCount();
}

// Fills in the little number badge on the "Cart" link
async function updateCartCount() {
    const countEl = document.getElementById('cart-count');
    if (!countEl || !isLoggedIn() || isAdmin()) return;

    try {
        const cart = await apiRequest('/cart', { auth: true });
        const totalQty = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        if (totalQty > 0) {
            countEl.textContent = totalQty;
            countEl.hidden = false;
        }
    } catch (err) {
        // Not critical if this fails silently — the page still works
    }
}

// Formats a number as currency, e.g. money(1500) -> "Rs. 1,500.00"
function money(amount) {
    return `Rs. ${Number(amount).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Renders a row of star icons for a rating (e.g. 4.5 out of 5), plus the
// review count in parentheses. Returns an empty string if there are no
// reviews yet, so product cards don't show "0 stars" for new products.
function renderStars(avgRating, reviewCount) {
    if (!reviewCount || reviewCount === 0) {
        return `<span class="stars-empty">No reviews yet</span>`;
    }

    const rating = parseFloat(avgRating) || 0;
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
        const filled = i <= Math.round(rating);
        starsHtml += `<svg width="14" height="14" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15 9 22 9 16.5 13.5 18.5 21 12 16.5 5.5 21 7.5 13.5 2 9 9 9"/></svg>`;
    }
    return `<span class="stars-row">${starsHtml}</span><span class="stars-count">${rating} (${reviewCount})</span>`;
}

// ---------- Password show/hide toggle ----------
// Any input wrapped like:
//   <div class="password-field">
//     <input type="password" id="password">
//     <button type="button" class="password-toggle" data-target="password">…eye icon…</button>
//   </div>
// gets wired up automatically to switch between hidden and visible text.

const EYE_OPEN = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_CLOSED = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.6 18.6 0 0 1 5.06-5.94M9.9 4.24A10.6 10.6 0 0 1 12 4c7 0 11 7 11 7a18.6 18.6 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>`;

function setupPasswordToggles() {
    document.querySelectorAll('.password-toggle').forEach(button => {
        const input = document.getElementById(button.dataset.target);
        if (!input) return;

        button.innerHTML = EYE_OPEN;
        button.setAttribute('aria-label', 'Show password');

        button.addEventListener('click', () => {
            const showing = input.type === 'text';
            input.type = showing ? 'password' : 'text';
            button.innerHTML = showing ? EYE_OPEN : EYE_CLOSED;
            button.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
        });
    });
}

// ---------- Toast notifications ----------
// A small popup that slides in (bottom-right), stays for a few seconds, then
// fades out on its own — used for things like "Order placed!" that deserve
// more visibility than a static message sitting in the page.

function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success'
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    toast.innerHTML = `${icon}<span>${message}</span>`;
    container.appendChild(toast);

    // Trigger the slide-in on the next frame so the transition actually plays
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

document.addEventListener('DOMContentLoaded', () => {
    renderNav();
    setupPasswordToggles();
});