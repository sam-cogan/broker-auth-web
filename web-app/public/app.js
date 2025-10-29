/**
 * Enterprise Auth Demo - Web Application
 * 
 * This application demonstrates Entra ID authentication with support for:
 * 1. Standard browser-based MSAL.js authentication
 * 2. Token injection from Chrome Custom Tabs (for native app SSO)
 * 3. Silent authentication flows
 */

let msalInstance;
let msalConfig;
let tokenResponse = null;

// DOM Elements
const elements = {
  loading: document.getElementById('loading'),
  unauthenticatedView: document.getElementById('unauthenticated-view'),
  authenticatedView: document.getElementById('authenticated-view'),
  loginButton: document.getElementById('loginButton'),
  logoutButton: document.getElementById('logoutButton'),
  getProfileButton: document.getElementById('getProfileButton'),
  getDataButton: document.getElementById('getDataButton'),
  userName: document.getElementById('userName'),
  userEmail: document.getElementById('userEmail'),
  userInitials: document.getElementById('userInitials'),
  dataDisplay: document.getElementById('dataDisplay'),
  dataContent: document.getElementById('dataContent'),
  statusText: document.getElementById('statusText'),
  tokenType: document.getElementById('tokenType'),
  tokenExpiry: document.getElementById('tokenExpiry'),
  tokenScopes: document.getElementById('tokenScopes'),
  debugInfo: document.getElementById('debug-info'),
  debugContent: document.getElementById('debug-content'),
};

/**
 * Initialize the application
 */
async function init() {
  try {
    updateStatus('Initializing...');
    
    // Ensure MSAL library is loaded
    if (typeof msal === 'undefined') {
      console.error('MSAL library not loaded');
      throw new Error('MSAL library failed to load. Please check your internet connection and refresh the page.');
    }
    
    // Fetch configuration from backend
    const config = await fetchConfig();
    
    // Initialize MSAL
    msalConfig = {
      auth: {
        clientId: config.clientId,
        authority: config.authority,
        redirectUri: config.redirectUri,
      },
      cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false,
      },
      system: {
        loggerOptions: {
          loggerCallback: (level, message, containsPii) => {
            if (containsPii) return;
            console.log(`[MSAL] ${message}`);
          },
          logLevel: 'Info',
        },
      },
    };

    msalInstance = new msal.PublicClientApplication(msalConfig);
    await msalInstance.initialize();

    // Check for session token in URL (from Chrome Custom Tabs / Native App)
    const sessionToken = checkForSessionTokenInUrl();
    
    if (sessionToken) {
      console.log('Session token detected - initializing session from native app');
      await handleSessionTokenExchange(sessionToken);
      return; // Skip normal MSAL flow
    }
    
    // Handle redirect response (standard MSAL flow)
    await msalInstance.handleRedirectPromise()
      .then(handleResponse)
      .catch(err => {
        console.error('Redirect error:', err);
        showDebugInfo(err);
      });

    // Check if user is already signed in
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      msalInstance.setActiveAccount(accounts[0]);
      await handleAuthenticatedUser(accounts[0]);
    } else {
      showUnauthenticatedView();
    }

    // Set up event listeners
    setupEventListeners();
    
    updateStatus('Ready');
  } catch (error) {
    console.error('Initialization error:', error);
    updateStatus('Error initializing', true);
    showDebugInfo(error);
  }
}

/**
 * Fetch configuration from backend
 */
async function fetchConfig() {
  const response = await fetch('/api/config');
  if (!response.ok) {
    throw new Error('Failed to fetch configuration');
  }
  return response.json();
}

/**
 * Check URL for session token parameter (from Chrome Custom Tabs)
 */
function checkForSessionTokenInUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('session_token');
}

/**
 * Handle session token from native app via Chrome Custom Tabs
 * Exchanges the short-lived session token for a proper authenticated session
 */
async function handleSessionTokenExchange(sessionToken) {
  try {
    showLoading(true);
    updateStatus('Initializing session from native app...');
    
    // Exchange session token for authenticated session
    const response = await fetch('/api/web/initialize-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // CRITICAL: Enables cookie setting
      body: JSON.stringify({ sessionToken }),
    });

    // IMMEDIATELY remove token from URL for security (even if exchange fails)
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);

    if (response.ok) {
      const data = await response.json();
      
      console.log('Session initialized successfully from native app');
      
      // Session cookie is now set by the backend
      // Create account object from response
      const account = {
        username: data.user.email || data.user.username || data.user.name,
        name: data.user.name,
        email: data.user.email,
      };

      await handleAuthenticatedUser(account);
      updateStatus('Authenticated via native app');
      
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Session initialization failed' }));
      console.error('Session token exchange failed:', errorData);
      throw new Error(errorData.error || 'Session initialization failed');
    }
  } catch (error) {
    console.error('Session token exchange error:', error);
    updateStatus('Session initialization failed, redirecting to login...', true);
    showDebugInfo(error);
    
    // Redirect to login after brief delay
    setTimeout(() => {
      showUnauthenticatedView();
    }, 2000);
  } finally {
    showLoading(false);
  }
}

/**
 * Handle MSAL redirect response
 */
async function handleResponse(response) {
  if (response !== null) {
    tokenResponse = response;
    msalInstance.setActiveAccount(response.account);
    await handleAuthenticatedUser(response.account);
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  elements.loginButton.addEventListener('click', signIn);
  elements.logoutButton.addEventListener('click', signOut);
  elements.getProfileButton.addEventListener('click', getProfile);
  elements.getDataButton.addEventListener('click', getData);
}

/**
 * Sign in user
 */
async function signIn() {
  try {
    showLoading(true);
    updateStatus('Signing in...');

    const loginRequest = {
      scopes: ['User.Read', 'profile', 'openid'],
    };

    // Try silent authentication first
    try {
      tokenResponse = await msalInstance.ssoSilent(loginRequest);
      handleResponse(tokenResponse);
    } catch (silentError) {
      console.log('Silent authentication failed, using interactive login');
      
      // Fall back to interactive login
      await msalInstance.loginRedirect(loginRequest);
    }
  } catch (error) {
    console.error('Sign in error:', error);
    updateStatus('Sign in failed', true);
    showDebugInfo(error);
  } finally {
    showLoading(false);
  }
}

/**
 * Sign out user
 */
async function signOut() {
  try {
    showLoading(true);
    updateStatus('Signing out...');

    const logoutRequest = {
      account: msalInstance.getActiveAccount(),
    };

    await msalInstance.logoutRedirect(logoutRequest);
  } catch (error) {
    console.error('Sign out error:', error);
    updateStatus('Sign out failed', true);
  } finally {
    showLoading(false);
  }
}

/**
 * Get access token for API calls
 */
async function getAccessToken() {
  const account = msalInstance.getActiveAccount();
  if (!account) {
    throw new Error('No active account');
  }

  const request = {
    scopes: ['User.Read'],
    account: account,
  };

  try {
    // Always try to get a fresh token silently
    const response = await msalInstance.acquireTokenSilent(request);
    tokenResponse = response;
    return response.accessToken;
  } catch (error) {
    console.error('Silent token acquisition failed:', error);
    
    // If silent acquisition fails, try interactive
    if (error.name === 'InteractionRequiredAuthError') {
      console.log('Interaction required, redirecting to login...');
      await msalInstance.acquireTokenRedirect(request);
    }
    throw error;
  }
}

/**
 * Get user profile
 */
async function getProfile() {
  try {
    showLoading(true);
    console.log('Attempting to get profile...');
    const token = await getAccessToken();
    console.log('Got access token, length:', token ? token.length : 0);

    // Call Microsoft Graph API directly
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    console.log('Profile response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Profile fetch failed:', errorText);
      throw new Error(`Failed to fetch profile: ${response.status}`);
    }

    const data = await response.json();
    console.log('Profile data received:', data);
    displayData(data);
  } catch (error) {
    console.error('Get profile error:', error);
    alert('Failed to fetch profile: ' + error.message);
  } finally {
    showLoading(false);
  }
}

/**
 * Get protected data
 */
async function getData() {
  try {
    showLoading(true);
    const token = await getAccessToken();

    const response = await fetch('/api/data', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch data');
    }

    const data = await response.json();
    displayData(data);
  } catch (error) {
    console.error('Get data error:', error);
    alert('Failed to fetch data: ' + error.message);
  } finally {
    showLoading(false);
  }
}

/**
 * Handle authenticated user
 */
async function handleAuthenticatedUser(account) {
  elements.userName.textContent = account.name || 'User';
  elements.userEmail.textContent = account.username || account.email || 'No email';
  
  // Set initials
  const initials = getInitials(account.name || account.username || 'U');
  elements.userInitials.textContent = initials;

  // Acquire token silently to get token info
  try {
    if (!tokenResponse) {
      const request = {
        scopes: ['User.Read'],
        account: account,
      };
      tokenResponse = await msalInstance.acquireTokenSilent(request);
    }
    
    // Display token info
    if (tokenResponse) {
      elements.tokenType.textContent = tokenResponse.tokenType || 'Bearer';
      elements.tokenExpiry.textContent = tokenResponse.expiresOn 
        ? new Date(tokenResponse.expiresOn).toLocaleString()
        : 'N/A';
      elements.tokenScopes.textContent = tokenResponse.scopes 
        ? tokenResponse.scopes.join(', ')
        : 'N/A';
    }
  } catch (error) {
    console.error('Failed to acquire token for display:', error);
    // Still show authenticated view even if token acquisition fails
  }

  showAuthenticatedView();
  updateStatus('Authenticated');
}

/**
 * Display data in the UI
 */
function displayData(data) {
  elements.dataContent.textContent = JSON.stringify(data, null, 2);
  elements.dataDisplay.style.display = 'block';
}

/**
 * Get user initials from name
 */
function getInitials(name) {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

/**
 * Show/hide loading state
 */
function showLoading(show) {
  elements.loading.style.display = show ? 'block' : 'none';
}

/**
 * Show authenticated view
 */
function showAuthenticatedView() {
  elements.unauthenticatedView.style.display = 'none';
  elements.authenticatedView.style.display = 'block';
  showLoading(false);
}

/**
 * Show unauthenticated view
 */
function showUnauthenticatedView() {
  elements.unauthenticatedView.style.display = 'block';
  elements.authenticatedView.style.display = 'none';
  showLoading(false);
}

/**
 * Update status indicator
 */
function updateStatus(text, isError = false) {
  elements.statusText.textContent = text;
  const indicator = document.querySelector('.status-indicator');
  
  if (isError) {
    indicator.classList.add('error');
  } else {
    indicator.classList.remove('error');
  }
}

/**
 * Show debug information
 */
function showDebugInfo(error) {
  const debugData = {
    message: error.message || 'Unknown error',
    name: error.name,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  };
  
  elements.debugContent.textContent = JSON.stringify(debugData, null, 2);
  elements.debugInfo.style.display = 'block';
}

/**
 * Wait for both DOM and MSAL library to be ready
 */
function waitForMSAL() {
  return new Promise((resolve) => {
    // Check if MSAL is already loaded
    if (typeof msal !== 'undefined') {
      resolve();
      return;
    }
    
    // Poll for MSAL availability
    const checkMSAL = setInterval(() => {
      if (typeof msal !== 'undefined') {
        clearInterval(checkMSAL);
        resolve();
      }
    }, 100);
    
    // Timeout after 10 seconds
    setTimeout(() => {
      clearInterval(checkMSAL);
      resolve(); // Resolve anyway to show error in init()
    }, 10000);
  });
}

/**
 * Initialize app when both DOM and MSAL are ready
 */
async function startApp() {
  await waitForMSAL();
  await init();
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
