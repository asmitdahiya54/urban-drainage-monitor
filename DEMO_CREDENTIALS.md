# Demo credentials (development only — NOT production)

Frontend-only demo sign-in, active in development/preview builds, or when
`VITE_ENABLE_DEMO_AUTH=true`. Nothing is verified by a server; accounts are
stored in the browser's localStorage. Not secure.

| Role    | Email               | Password      | Lands on     |
|---------|---------------------|---------------|--------------|
| Citizen | citizen@demo.local  | Citizen@123   | `/dashboard` |
| Admin   | admin@demo.local    | Admin@123     | `/admin`     |

- New accounts created on `/register` (when the real backend is unreachable)
  are saved as demo citizens in this browser and can sign in afterwards.
- When the Flask backend is reachable, normal email/password accounts are used first.
- Logout clears the session and returns to `/login`.
