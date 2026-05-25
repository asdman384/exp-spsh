# Development Environment

## Windows PowerShell Setup

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser  # before work
Set-ExecutionPolicy Restricted                        # after work
```

## Dependencies

- **Angular**: 21.2.13 (platform-browser, forms, material, router, animations, service-worker)
- **NgRx**: 21.1.0 (store, effects, entity, store-devtools)
- **Material**: 21.2.11
- **RxJS**: 7.8.2
- **Tooling**: Angular CLI 21.2.11, TypeScript 5.9.3

## Pitfalls & Notes

- **keys.json required**: Build will fail silently if not configured
- **HashLocationStrategy**: Used intentionally to support file:// serving
- **Single Chrome instance**: Karma tests run in single browser, not headless by default
- **Service Worker caching**: May need cache invalidation during development
- **Strict typing**: `noPropertyAccessFromIndexSignature` means avoid dynamic property access without typed keys
