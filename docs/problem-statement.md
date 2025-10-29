# 🧩 Problem Statement Summary for PoC Requirements

## Context

Enterprise users are experiencing frequent login disruptions across enterprise devices, particularly when navigating between applications launched via the Hub App. This impacts productivity and user satisfaction, with login issues consistently surfacing in internal surveys and feedback.

## Key Issues Identified

### Session Inconsistency

Sessions do not persist across the 50+ web applications launched from the native Hub App. Users are repeatedly prompted to log in when switching between apps.

### Authentication Fragmentation

While the Hub App is a native Android/iOS app, most of the launched apps are web-based and lack unified session management. Some apps use legacy username/password authentication, while the majority use Entra SSO (SAML/OpenID Connect).

### Device Diversity

Primary devices are enterprise-managed Android handsets, but the app is also used on iOS and personal devices (BYOD). BYOD introduces additional complexity and security concerns.

### Conditional Access & MFA

Conditional Access policies may be enforcing redundant MFA prompts or session timeouts. These policies need to be reviewed and optimised to support seamless authentication.

## Assumptions for PoC

- All apps are or will be Entra-joined and use MSAL libraries for authentication.
- Devices are managed via MDM and registered in Entra.
- Microsoft Authenticator will be used for brokered authentication; Company Portal is being phased out.
- The PoC will focus on enterprise-managed devices, with BYOD considered a secondary phase.

## PoC Goals

- Enable seamless single sign-on (SSO) across native and web apps launched from Hub App.
- Maintain session continuity across app transitions without repeated logins.
- Leverage brokered authentication via Microsoft Authenticator for native apps.
- Investigate token sharing mechanisms between native and web apps to avoid re-authentication.
- Audit and optimise Conditional Access policies to reduce unnecessary MFA prompts.
- Establish MSAL compliance as a prerequisite for apps to be hosted on the Hub.

## Implementation Considerations

- Identify and categorise apps by ownership and technology stack to prioritise migration.
- Address edge cases (e.g. legacy apps) separately.
- **Chrome Custom Tabs vs WebView Trade-offs**:
  - Chrome Custom Tabs offer better authentication and browser experience
  - WebView currently enables critical native-to-web bridging (barcode scanning, printing, etc.)
  - Migration from WebView to Chrome Custom Tabs requires solving the bridging challenge
  - Trusted Web Activities being explored as potential hybrid solution
  - PoC will prioritize Chrome Custom Tabs with WebView as secondary approach if time permits
- Native functionality bridges (barcode scanner events, printing) are critical for user journeys and must be maintained
```