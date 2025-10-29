# GitHub Copilot Instructions - Enterprise Auth PoC

## Project Overview

This is a **4-day Proof of Concept** demonstrating seamless authentication flow across an enterprise mobile application ecosystem: Native Hub App → Native App → Web App. The goal is to eliminate authentication fragmentation and repeated login prompts that disrupt user productivity.

## Core Problem Being Solved

Enterprise users experience frequent login disruptions when navigating between 50+ applications launched from the Hub App. Sessions don't persist, causing repeated authentication prompts and impacting productivity.

## Technical Context

### Authentication Architecture
- **Identity Provider**: Microsoft Entra ID (Azure AD)
- **Native Apps**: MSAL Android with brokered authentication via Microsoft Authenticator
- **Web Apps**: MSAL.js 2.x+ with OpenID Connect / OAuth 2.0
- **Token Sharing**: Android Keystore for secure storage, Chrome Custom Tabs for web integration
- **Devices**: Enterprise Android devices (MDM managed)

### Key Assumptions
- All apps are or will be Entra-joined using MSAL libraries
- Microsoft Authenticator is the broker (Company Portal being phased out)
- Focus on enterprise-managed devices first, BYOD is secondary
- MSAL compliance is required for apps hosted on the Hub

## Development Guidelines

### Authentication Flow Pattern
```
1. Hub App → Brokered auth via Microsoft Authenticator (one-time)
2. Hub App → Stores access token securely in Android Keystore
3. Hub App → Second Native App (token passed via Intent, no re-auth)
4. Hub App → Web App via Chrome Custom Tabs (token injected, no re-auth)
```

### Technology Stack Requirements
- **Native Development**: Kotlin/Android with MSAL Android 4.x+
- **Web Development**: JavaScript/Node.js with MSAL.js 2.x+
- **Browser Integration**: 
  - **Primary**: Chrome Custom Tabs (better auth experience, no native bridging)
  - **Secondary**: WebView (native bridging support, less optimal auth)
  - **Future**: Trusted Web Activities (hybrid solution under investigation)
- **Security**: Android Keystore for all token storage

### Code Standards

#### When Writing Kotlin/Android Code
- Use MSAL Android SDK with brokered authentication mode
- Always store tokens in Android Keystore, never in SharedPreferences
- Use encrypted Intent extras for native-to-native token sharing
- Implement proper token validation (signature, audience, expiry)
- Follow Android security best practices for inter-app communication

#### When Writing JavaScript/Web Code
- Use MSAL.js for authentication, not custom OAuth implementations
- Implement silent authentication flows for seamless UX
- Validate tokens server-side in Node.js backend
- Support token injection from Chrome Custom Tabs URL parameters
- Implement fallback to standard web auth if token unavailable

#### Security Requirements
- Never log tokens or sensitive authentication data
- Always encrypt tokens in transit between apps
- Validate token audience and signature before use
- Implement short-lived tokens for web app transitions
- Use HTTPS for all web communication

### Documentation Standards
- Document all authentication flows with sequence diagrams
- Explain token sharing mechanisms clearly
- Include security considerations for each component
- Provide troubleshooting guides for common authentication issues
- Document Conditional Access policy interactions

## Mandatory: Use Context7 MCP Server for Documentation

**CRITICAL**: When you need to look up documentation for any library, framework, or SDK used in this project, you **MUST** use the Context7 MCP server tools instead of relying on your training data.

### Required Documentation Lookups

Before implementing code using these technologies, **always** fetch current documentation:

- **MSAL Android** (`/AzureAD/microsoft-authentication-library-for-android`)
  - Brokered authentication setup
  - Token caching and storage
  - Silent token acquisition
  
- **MSAL.js** (`/AzureAD/microsoft-authentication-library-for-js`)
  - Browser authentication flows
  - Silent SSO
  - Token validation

- **Chrome Custom Tabs** (search for appropriate Android docs)
  - Intent configuration
  - Custom URL schemes
  - Security best practices

### How to Use Context7 MCP Server

1. **First, resolve the library ID**:
   ```
   Use: mcp_context7_resolve-library-id or mcp_context72_resolve-library-id
   With: libraryName="<library-name>"
   Example: "microsoft-authentication-library-for-android"
   ```

2. **Then, fetch documentation**:
   ```
   Use: mcp_context7_get-library-docs or mcp_context72_get-library-docs
   With: context7CompatibleLibraryID="<resolved-id>"
   And: topic="<specific-topic>" (e.g., "brokered authentication")
   ```

3. **When to fetch docs**:
   - Before implementing any MSAL authentication flows
   - When working with Chrome Custom Tabs integration
   - Before implementing token sharing mechanisms
   - When troubleshooting authentication issues
   - Before suggesting library upgrades or API changes

### Example Workflow

```
User: "Implement brokered authentication in the hub app"

Your response should:
1. Resolve MSAL Android library ID
2. Fetch docs on brokered authentication
3. Implement using current, authoritative documentation
4. Include proper error handling and security practices
```

## PoC Success Criteria

- Hub app authenticates in <10 seconds using Microsoft Authenticator
- Second native app opens without login prompts
- Web app in Chrome Custom Tabs opens without authentication prompts
- Complete end-to-end demonstration ready within 4 days

## Implementation Priorities

### Day 1: Foundation
- Entra ID tenant and app registrations
- Development environment setup
- Basic project structure

### Day 2: Hub App
- MSAL Android with brokered auth
- Token storage in Android Keystore
- Token sharing infrastructure

### Day 3: Integration
- Second native app with token reception
- Chrome Custom Tabs with token passing
- End-to-end native flow testing

### Day 4: Web App & Polish
- Web app with MSAL.js
- Token validation backend
- Final testing and demo preparation

## Known Constraints

- BYOD devices add complexity (secondary phase)
- Some legacy apps (RSS, Rascal) may need separate handling
- Conditional Access policies need review and optimization
- 50+ web apps will need eventual migration to MSAL
- **Native-to-Web Bridging Challenge**:
  - Chrome Custom Tabs provide better auth but no JavaScript bridge
  - WebView enables native bridging (barcode scanning, printing) but less optimal auth
  - Critical device features (Zebra scanner, printing) must be maintained
  - Trusted Web Activities being explored as potential hybrid solution
  - PoC will prioritize Chrome Custom Tabs with WebView investigation if time permits

## Code Review Checklist

When suggesting or reviewing code:
- [ ] Uses Context7 MCP server for up-to-date documentation
- [ ] Implements proper token encryption and storage
- [ ] Follows authentication flow pattern (no duplicate logins)
- [ ] Includes error handling for authentication failures
- [ ] Documents security considerations
- [ ] Validates tokens properly (audience, signature, expiry)
- [ ] Uses Android Keystore for sensitive data
- [ ] Implements silent authentication where possible
- [ ] Includes logging for debugging (without sensitive data)
- [ ] Compatible with enterprise Android devices

## Anti-Patterns to Avoid

- ❌ Storing tokens in SharedPreferences or plain text
- ❌ Using WebView when Chrome Custom Tabs would suffice (unless native bridging required)
- ❌ Implementing custom OAuth flows instead of using MSAL
- ❌ Prompting for authentication when valid token exists
- ❌ Hardcoding credentials or tenant IDs
- ❌ Skipping token validation on the backend
- ❌ Logging sensitive authentication data
- ❌ Implementing authentication without consulting current docs via Context7
- ❌ Sacrificing critical native functionality (barcode scanning, printing) for better auth without alternative solution

## Questions to Ask

When requirements are unclear:
- Which Entra ID tenant should be used (prod/dev/test)?
- What are the specific Conditional Access policies in place?
- Are there rate limits on token refresh?
- What's the expected token lifetime?
- Which apps should be prioritized for MSAL migration?
- Are there specific compliance requirements (e.g., PCI DSS)?
- Does this web app require native functionality (barcode scanning, printing)?
- Should we use Chrome Custom Tabs or WebView for this use case?
- Are there any other native-to-web bridging requirements?

## Additional Resources

Refer to project documentation:
- `/docs/poc-requirements.md` - Detailed technical requirements
- `/docs/problem-statement.md` - Business context and problem definition
- `/docs/browser-integration-strategy.md` - Chrome Custom Tabs vs WebView analysis and native bridging considerations
- `/docs/web-app-component.md` - Web application technical documentation

---

**Remember**: This is a 4-day PoC focused on demonstrating feasibility. Prioritize working demonstrations over perfect production-ready code, but never compromise on security fundamentals.
