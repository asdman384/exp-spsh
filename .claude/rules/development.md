# Development Environment

## Windows PowerShell Setup

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser  # before work
Set-ExecutionPolicy Restricted                        # after work
```

## Dependencies

- **Angular**: 22.1.6 (platform-browser, forms, material, router, animations, service-worker)
- **NgRx**: 22.0.1 (store, effects, entity, store-devtools)
- **Material**: 22.1.6
- **RxJS**: 7.8.2
- **Tooling**: Angular CLI 22.1.8, TypeScript 6.0.3
- **Node.js**: requires >= 22.22.3 (or >= 24.15.0 / >= 26.0.0) since Angular CLI 22 raised its minimum

## Pitfalls & Notes

- **keys.json required**: Build will fail silently if not configured
- **HashLocationStrategy**: Used intentionally to support file:// serving
- **Unit tests**: Angular's Vitest runner uses configured headless Chromium; `npm run test:headed` changes watch mode, not browser visibility
- **Service Worker caching**: May need cache invalidation during development
- **Strict typing**: `noPropertyAccessFromIndexSignature` means avoid dynamic property access without typed keys
