const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// JWKS client for token validation
const client = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${process.env.TENANT_ID}/discovery/v2.0/keys`,
  cache: true,
  rateLimit: true,
});

// Get signing key from JWKS
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

// Middleware to validate JWT token (simplified for demo)
async function validateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);

  try {
    // For demo purposes: decode without verification (token is from Microsoft)
    // In production, you would validate the signature against your API's app registration
    const decoded = jwt.decode(token, { complete: true });
    
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    // Basic validation
    const payload = decoded.payload;
    
    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return res.status(401).json({ error: 'Token expired' });
    }

    // For demo: accept tokens from Microsoft (aud could be Graph API or our client)
    console.log('Token received - Issuer:', payload.iss, 'Audience:', payload.aud);
    
    // Attach decoded payload to request
    req.user = payload;
    next();
  } catch (error) {
    console.error('Token validation exception:', error);
    res.status(401).json({ error: 'Token validation failed', details: error.message });
  }
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://login.microsoftonline.com", "https://*.msauth.net", "https://graph.microsoft.com"],
      frameSrc: ["https://login.microsoftonline.com"],
    },
  },
}));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve MSAL library from node_modules
app.use('/libs/msal', express.static(path.join(__dirname, 'node_modules/@azure/msal-browser/lib')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    tenantId: process.env.TENANT_ID ? '***configured***' : 'missing',
    clientId: process.env.CLIENT_ID ? '***configured***' : 'missing',
  });
});

// Configuration endpoint for frontend
app.get('/api/config', (req, res) => {
  res.json({
    clientId: process.env.CLIENT_ID,
    authority: process.env.AUTHORITY || `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
    redirectUri: process.env.REDIRECT_URI || `http://localhost:${PORT}/auth/callback`,
    scopes: process.env.API_SCOPES 
      ? process.env.API_SCOPES.split(',').map(s => s.trim())
      : ['User.Read', 'profile', 'openid'],
  });
});

// Protected API endpoint - requires valid token
app.get('/api/user/profile', validateToken, (req, res) => {
  res.json({
    message: 'Successfully authenticated!',
    user: {
      name: req.user.name || 'Unknown',
      username: req.user.preferred_username || req.user.upn || 'Unknown',
      email: req.user.email || req.user.preferred_username || 'Unknown',
      oid: req.user.oid,
      tid: req.user.tid,
    },
    tokenClaims: req.user,
  });
});

// Protected API endpoint - demo data
app.get('/api/data', validateToken, (req, res) => {
  res.json({
    message: 'This is protected data from the backend',
    timestamp: new Date().toISOString(),
    user: req.user.preferred_username || req.user.name,
    data: [
      { id: 1, item: 'Demo Item 1', status: 'Active' },
      { id: 2, item: 'Demo Item 2', status: 'Pending' },
      { id: 3, item: 'Demo Item 3', status: 'Completed' },
    ],
  });
});

// Token validation endpoint (for testing)
app.post('/api/validate-token', validateToken, (req, res) => {
  res.json({
    valid: true,
    message: 'Token is valid',
    user: {
      name: req.user.name,
      email: req.user.preferred_username || req.user.email,
    },
  });
});

// Session initialization endpoint - exchanges session token for authenticated session
// Called by web app when launched from native app via Chrome Custom Tabs
app.post('/api/web/initialize-session', async (req, res) => {
  const { sessionToken } = req.body;
  
  if (!sessionToken) {
    return res.status(400).json({ error: 'Session token required' });
  }

  try {
    // Call backend service to validate and exchange session token
    // In a real implementation, this would call your backend API
    // For PoC, we'll validate the token format and simulate success
    
    // TODO: Replace with actual backend call
    // const backendResponse = await fetch('https://your-backend/api/validate-session-token', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ sessionToken })
    // });
    
    // For PoC: Decode the session token (assuming it's a JWT with user info)
    const decoded = jwt.decode(sessionToken, { complete: true });
    
    if (!decoded || !decoded.payload) {
      return res.status(401).json({ error: 'Invalid session token format' });
    }

    const payload = decoded.payload;
    
    // Validate token hasn't expired
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return res.status(401).json({ error: 'Session token expired' });
    }

    // Validate token type (should be marked as session initialization token)
    if (payload.type !== 'session_init') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // In production, also check:
    // - Token hasn't been used before (single-use)
    // - Token is from your backend (verify signature)
    // - Token audience matches this web app

    // Create session for the user
    // For PoC, we'll set a simple session cookie
    // In production, use proper session management
    const sessionData = {
      userId: payload.sub || payload.oid,
      email: payload.email || payload.preferred_username,
      name: payload.name,
      authenticatedAt: Date.now(),
    };

    // Set HTTP-only session cookie
    res.cookie('session', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    // Return success with user info
    res.json({
      success: true,
      message: 'Session initialized successfully',
      user: {
        name: payload.name,
        email: payload.email || payload.preferred_username,
        username: payload.preferred_username || payload.email,
      },
    });

    console.log('Session initialized for user:', payload.name || payload.email);
    
  } catch (error) {
    console.error('Session initialization error:', error);
    res.status(401).json({ 
      error: 'Session initialization failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Serve main HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 Tenant ID: ${process.env.TENANT_ID ? '***configured***' : '⚠️  MISSING'}`);
  console.log(`🔑 Client ID: ${process.env.CLIENT_ID ? '***configured***' : '⚠️  MISSING'}`);
  
  if (!process.env.TENANT_ID || !process.env.CLIENT_ID) {
    console.warn('\n⚠️  WARNING: Missing required environment variables!');
    console.warn('Copy .env.example to .env and configure your Azure AD settings.\n');
  }
});
