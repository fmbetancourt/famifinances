# @famifinances/mobile

Expo + React Native (Expo Router) mobile app for FamiFinances.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_BASE` | `http://localhost:3000/api/v1` | Base URL of the FamiFinances REST API. On a physical device, set this to your machine's LAN IP (e.g. `http://192.168.1.20:3000/api/v1`) so the device can reach the API. |

`EXPO_PUBLIC_*` variables are inlined by Expo at build time; never put secrets here.

## Scripts

```bash
pnpm --filter @famifinances/mobile start       # Expo dev server
pnpm --filter @famifinances/mobile android      # open on Android
pnpm --filter @famifinances/mobile ios          # open on iOS
pnpm --filter @famifinances/mobile typecheck    # tsc --noEmit (strict, no `any`)
pnpm --filter @famifinances/mobile test         # jest (unit + component)
```

## Auth routing map (FAM-8)

The app boots into a loading gate while the session is restored from SecureStore, then
routes by session state. Expo Router groups `(auth)`/`(app)`/`(family)` are **omitted**
from URLs.

| File | URL | Access |
|---|---|---|
| `app/_layout.tsx` | — | Root: wraps the tree in `<SessionProvider>`, shows a loading gate while `status === 'loading'`. |
| `app/index.tsx` | `/` | Launch redirect: routes by `nextRoute(session)`. |
| `app/(auth)/sign-in.tsx` | `/sign-in` | Public. Redirects to `/` once authenticated. |
| `app/(auth)/sign-up.tsx` | `/sign-up` | Public. Real-time password-policy feedback. |
| `app/(auth)/verify-email.tsx` | `/verify-email` | Public. OTP; reloads session on success. |
| `app/(auth)/forgot-password.tsx` | `/forgot-password` | Public. |
| `app/(auth)/reset-password.tsx` | `/reset-password` | Public. |
| `app/(app)/home.tsx` | `/home` | Protected. Redirects to `/sign-in` when unauthenticated (SC-004). |
| `app/(family)/onboarding.tsx` | `/onboarding` | Authenticated + no family (FR-007). Placeholder — full Create/Join UI ships in FAM-9. |

Session logic lives in `src/features/auth/session/` (context, bootstrap, password policy,
sign-out, routing). Tokens are held **only** in SecureStore, never in React state or logs
(FR-006).
