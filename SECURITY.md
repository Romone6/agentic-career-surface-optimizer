# Security Policy

## Supported Versions

Only the latest major version is supported with security updates.

## Reporting Vulnerabilities

Please report security vulnerabilities by opening an issue on GitHub with the "security" label.

## Security Design Principles

### 1. Local-First Architecture
- All data stored locally on user's machine
- No cloud storage or transmission of sensitive data
- SQLite database encrypted at rest (future enhancement)

### 2. Authentication Safety
- **No password collection**: User must login manually to all platforms
- **No session hijacking**: Uses OAuth flows and browser automation within logged-in sessions
- **No credential storage**: Only stores OAuth tokens securely for current session

### 3. Automation Safety
- **Run-level approval**: Requires explicit user approval before any automation run
- **Stop-before-submit**: Form filling stops before final submission by default
- **Dry-run mode**: All automation can run in read-only mode for verification

### 4. Data Privacy
- **Minimal data collection**: Only collects what's necessary for profile optimization
- **No scraping**: Only reads user's own profile data
- **No third-party sharing**: Data never leaves user's machine

### 5. Compliance
- **Terms of Service**: Designed to comply with platform ToS
- **Rate limiting**: Respects API rate limits
- **No stealth operations**: Transparent about all actions

## Security Features

### OpenRouter Integration
- API key stored in .env file (gitignored)
- Request validation and sanitization
- Rate limiting and error handling

### GitHub Adapter
- OAuth device flow for authentication
- Token stored securely in local storage
- API request signing and validation

### LinkedIn Automation
- Requires user to be logged in
- Only operates within user's authenticated session
- Selector verification before any action

### Job Application
- Domain allowlist for form filling
- Stop-before-submit default behavior
- Manual review required

## User Responsibilities

1. Keep your .env file secure
2. Use strong, unique passwords for all platforms
3. Review all automation actions before approval
4. Keep the software updated
5. Report any security concerns immediately

## Incident Response

1. **Discovery**: Issue identified through testing, monitoring, or user report
2. **Triage**: Assess severity and impact
3. **Containment**: Implement temporary mitigation if needed
4. **Patch**: Develop and test fix
5. **Release**: Publish security update
6. **Disclosure**: Notify users if appropriate

## Security Checklist for Contributors

- [ ] All sensitive data properly sanitized
- [ ] No hardcoded credentials
- [ ] Proper error handling without information leakage
- [ ] Input validation for all user inputs
- [ ] Secure storage of tokens and API keys
- [ ] Compliance with platform ToS
- [ ] Proper logging without sensitive data
- [ ] Rate limiting respected
- [ ] User approval required for destructive actions
- [ ] Tests cover security scenarios