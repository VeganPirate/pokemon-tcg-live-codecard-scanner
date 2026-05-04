// Supabase Configuration
const SUPABASE_URL = 'https://rsaukpzvzbglnyepqymx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_PAIT74pEkQ3lU49OQcUMTg_BBstXOfi';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

// Initialize Auth UI
const authModal = document.getElementById('auth-modal');
authModal.innerHTML = `
    <div class="modal-content">
        <span class="close">&times;</span>
        <h2 id="auth-title">Welcome Back</h2>
        
        <button id="google-login-btn" class="oauth-btn">
            <img src="https://www.google.com/favicon.ico" alt="Google"> <span id="google-btn-text">Sign in with Google</span>
        </button>

        <div id="auth-divider" class="divider"><span>or use email</span></div>

        <form id="auth-form">
            <input type="email" id="email" placeholder="Email" required>
            <input type="password" id="password" placeholder="Password" required>
            <button type="submit" id="auth-submit-btn" class="primary-btn">Login</button>
        </form>

        <div class="auth-footer">
            <a href="#" id="toggle-auth-link">Don't have an account? Sign Up</a>
            <a href="#" id="reset-password-link">Forgot password?</a>
        </div>
        
        <p id="auth-error"></p>
    </div>
`;

const authBtn = document.getElementById('auth-btn');
const closeBtn = authModal.querySelector('.close');
const authForm = document.getElementById('auth-form');
const authError = document.getElementById('auth-error');
const userEmailSpan = document.getElementById('user-email');
const googleLoginBtn = document.getElementById('google-login-btn');
const googleBtnText = document.getElementById('google-btn-text');
const authTitle = document.getElementById('auth-title');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const toggleAuthLink = document.getElementById('toggle-auth-link');
const resetPasswordLink = document.getElementById('reset-password-link');
const passwordInput = document.getElementById('password');
const authDivider = document.getElementById('auth-divider');

let authMode = 'login'; // 'login', 'signup', or 'reset'

const REDIRECT_URL = 'https://veganpirate.github.io/pokemon-tcg-live-codecard-scanner/';

function updateAuthUI() {
    authError.textContent = '';
    authError.style.color = '#FF4444';

    if (authMode === 'login') {
        authTitle.textContent = 'Welcome Back';
        googleBtnText.textContent = 'Sign in with Google';
        authSubmitBtn.textContent = 'Login';
        toggleAuthLink.textContent = "Don't have an account? Sign Up";
        toggleAuthLink.style.display = 'block';
        resetPasswordLink.style.display = 'block';
        passwordInput.style.display = 'block';
        passwordInput.placeholder = 'Password';
        passwordInput.required = true;
        googleLoginBtn.style.display = 'flex';
        authDivider.style.display = 'block';
    } else if (authMode === 'signup') {
        authTitle.textContent = 'Sign Up';
        googleBtnText.textContent = 'Sign Up with Google';
        authSubmitBtn.textContent = 'Sign Up';
        toggleAuthLink.textContent = "Already have an account? Login";
        toggleAuthLink.style.display = 'block';
        resetPasswordLink.style.display = 'none';
        passwordInput.style.display = 'block';
        passwordInput.placeholder = 'Password';
        passwordInput.required = true;
        googleLoginBtn.style.display = 'flex';
        authDivider.style.display = 'block';
    } else if (authMode === 'reset') {
        authTitle.textContent = 'Reset Password';
        authSubmitBtn.textContent = 'Send Reset Link';
        toggleAuthLink.textContent = "Back to Login";
        toggleAuthLink.style.display = 'block';
        resetPasswordLink.style.display = 'none';
        passwordInput.style.display = 'none';
        passwordInput.required = false;
        googleLoginBtn.style.display = 'none';
        authDivider.style.display = 'none';
    } else if (authMode === 'update_password') {
        authTitle.textContent = 'Set New Password';
        authSubmitBtn.textContent = 'Update Password';
        passwordInput.style.display = 'block';
        passwordInput.placeholder = 'New Password';
        passwordInput.required = true;
        toggleAuthLink.style.display = 'none';
        resetPasswordLink.style.display = 'none';
        googleLoginBtn.style.display = 'none';
        authDivider.style.display = 'none';
        authModal.style.display = 'block';
    }
}

// Check for auth flows on load via URL params
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('resetPassword')) {
        authMode = 'update_password';
        updateAuthUI();
    } else if (urlParams.get('login') === 'show') {
        authMode = 'login';
        updateAuthUI();
        authModal.style.display = 'block';
    }
});

// Auth State Management
_supabase.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    if (currentUser) {
        authBtn.textContent = 'Sign Out';
        userEmailSpan.textContent = currentUser.email;
        authModal.style.display = 'none';
    } else {
        authBtn.textContent = 'Sign In';
        userEmailSpan.textContent = '';
    }
});

authBtn.onclick = async () => {
    if (currentUser) {
        await _supabase.auth.signOut();
    } else {
        authMode = 'login';
        updateAuthUI();
        authModal.style.display = 'block';
    }
};

closeBtn.onclick = () => authModal.style.display = 'none';
window.addEventListener('click', (event) => {
    if (event.target == authModal) authModal.style.display = 'none';
});

// Google Login
googleLoginBtn.onclick = async () => {
    const { error } = await _supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: REDIRECT_URL
        }
    });
    if (error) authError.textContent = error.message;
};

// Toggle Login/Signup
toggleAuthLink.onclick = (e) => {
    e.preventDefault();
    if (authMode === 'login' || authMode === 'reset') {
        authMode = 'signup';
    } else {
        authMode = 'login';
    }
    updateAuthUI();
};

// Reset Password Link
resetPasswordLink.onclick = (e) => {
    e.preventDefault();
    authMode = 'reset';
    updateAuthUI();
};

authForm.onsubmit = async (e) => {
    e.preventDefault();
    authError.textContent = '';
    authError.style.color = '#FF4444';
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Add loading state
    const originalBtnText = authSubmitBtn.innerHTML;
    authSubmitBtn.disabled = true;
    authSubmitBtn.innerHTML = '<span class="spinner"></span> Processing...';
    authSubmitBtn.classList.add('processing');

    let result;
    try {
        if (authMode === 'login') {
            result = await _supabase.auth.signInWithPassword({ email, password });
        } else if (authMode === 'signup') {
            result = await _supabase.auth.signUp({ email, password });
        } else if (authMode === 'reset') {
            result = await _supabase.auth.resetPasswordForEmail(email, {
                redirectTo: REDIRECT_URL + '?resetPassword=true'
            });
        } else if (authMode === 'update_password') {
            result = await _supabase.auth.updateUser({ password: password });
        }

        if (result && result.error) {
            authError.textContent = result.error.message;
        } else if (authMode === 'signup') {
            authError.style.color = '#00FF00';
            authError.textContent = 'Sign up successful! Check your email.';
        } else if (authMode === 'reset') {
            authError.style.color = '#00FF00';
            authError.textContent = 'Password reset email sent!';
        } else if (authMode === 'update_password') {
            authError.style.color = '#00FF00';
            authError.textContent = 'Password updated! You are now logged in.';
            setTimeout(() => {
                authMode = 'login';
                updateAuthUI();
                authModal.style.display = 'none';
                window.history.replaceState({}, document.title, window.location.pathname);
            }, 2000);
        }
    } catch (err) {
        authError.textContent = "An unexpected error occurred.";
        console.error(err);
    } finally {
        // Restore button state
        authSubmitBtn.disabled = false;
        authSubmitBtn.innerHTML = originalBtnText;
        authSubmitBtn.classList.remove('processing');
    }
};

async function saveToSupabase(qrValue, ocrValue = null) {
    if (!currentUser) return;

    try {
        const { error } = await _supabase
            .from('scanned_codes')
            .insert([
                { 
                    user_id: currentUser.id, 
                    qr_content: qrValue, 
                    ocr_content: ocrValue,
                    created_at: new Date().toISOString()
                }
            ]);
        
        if (error) console.error('Error saving to Supabase:', error.message);
        else console.log('Saved to Supabase successfully');
    } catch (err) {
        console.error('Save failed:', err);
    }
}

async function updateOcrInSupabase(qrValue, ocrValue) {
    if (!currentUser) return;
    try {
        const { error } = await _supabase
            .from('scanned_codes')
            .update({ ocr_content: ocrValue })
            .eq('qr_content', qrValue)
            .eq('user_id', currentUser.id);
        
        if (error) console.error('Error updating OCR in Supabase:', error.message);
    } catch (err) {
        console.error('Update failed:', err);
    }
}

// Export functions to window so app.js can use them
window.saveToSupabase = saveToSupabase;
window.updateOcrInSupabase = updateOcrInSupabase;
