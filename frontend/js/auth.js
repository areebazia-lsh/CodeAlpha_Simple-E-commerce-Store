// Logic shared by all four auth pages: login.html, register.html,
// admin-login.html and admin-register.html. Only one of these forms
// exists on any given page, so each block below checks "if (form)"
// before attaching its handler.

const formAlert = document.getElementById('form-alert');

// After logging in, send the user somewhere sensible:
// - if they were redirected here from a page that required login, go back there
// - otherwise, customers go to the shop and admins go to their dashboard
function redirectAfterAuth(user) {
    const redirectTo = new URLSearchParams(window.location.search).get('redirect');
    if (redirectTo) {
        window.location.href = redirectTo;
    } else if (user.role === 'admin') {
        window.location.href = 'admin-dashboard.html';
    } else {
        window.location.href = 'shop.html';
    }
}

function setLoading(button, isLoading, loadingText, normalText) {
    button.disabled = isLoading;
    button.textContent = isLoading ? loadingText : normalText;
}

// ---------- Customer login ----------
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = document.getElementById('submit-btn');
        setLoading(button, true, 'Logging in…', 'Log In');

        try {
            const data = await apiRequest('/auth/login', {
                method: 'POST',
                body: {
                    email: document.getElementById('email').value.trim(),
                    password: document.getElementById('password').value,
                    role: 'customer'
                }
            });
            saveSession(data.token, data.user);
            redirectAfterAuth(data.user);
        } catch (err) {
            formAlert.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
            setLoading(button, false, '', 'Log In');
        }
    });
}

// ---------- Customer registration ----------
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = document.getElementById('submit-btn');
        setLoading(button, true, 'Signing up…', 'Sign Up');

        try {
            const data = await apiRequest('/auth/register', {
                method: 'POST',
                body: {
                    name: document.getElementById('name').value.trim(),
                    email: document.getElementById('email').value.trim(),
                    password: document.getElementById('password').value
                    // no "role" sent here -> backend defaults to "customer"
                }
            });
            saveSession(data.token, data.user);
            redirectAfterAuth(data.user);
        } catch (err) {
            formAlert.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
            setLoading(button, false, '', 'Sign Up');
        }
    });
}

// ---------- Admin login ----------
const adminLoginForm = document.getElementById('admin-login-form');
if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = document.getElementById('submit-btn');
        setLoading(button, true, 'Logging in…', 'Log In');

        try {
            const data = await apiRequest('/auth/login', {
                method: 'POST',
                body: {
                    email: document.getElementById('email').value.trim(),
                    password: document.getElementById('password').value,
                    role: 'admin'
                }
            });
            saveSession(data.token, data.user);
            redirectAfterAuth(data.user);
        } catch (err) {
            formAlert.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
            setLoading(button, false, '', 'Log In');
        }
    });
}

// ---------- Admin registration ----------
const adminRegisterForm = document.getElementById('admin-register-form');
if (adminRegisterForm) {
    adminRegisterForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = document.getElementById('submit-btn');
        setLoading(button, true, 'Signing up…', 'Sign Up');

        try {
            const data = await apiRequest('/auth/register', {
                method: 'POST',
                body: {
                    name: document.getElementById('name').value.trim(),
                    email: document.getElementById('email').value.trim(),
                    password: document.getElementById('password').value,
                    role: 'admin',
                    adminCode: document.getElementById('admin-code').value.trim()
                }
            });
            saveSession(data.token, data.user);
            redirectAfterAuth(data.user);
        } catch (err) {
            formAlert.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
            setLoading(button, false, '', 'Sign Up');
        }
    });
}