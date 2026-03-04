# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Multiplayer WebSocket server

The multiplayer server is in `server/wsServer.js` and can run with in-memory room state (default) or Redis-backed shared room state.

### Environment variables

- `PORT` (default `8080`)
- `DEBUG_WS=1` to log sync events
- `INSTANCE_ID` optional stable instance tag for diagnostics
- `REDIS_URL` enables shared room state across instances
- `REDIS_TTL_SECONDS` optional room snapshot TTL (default 21600 seconds)

### Multi-instance production recommendation

Set `REDIS_URL` in production so room/state lookup is shared across instances. Without Redis, room state is process-local and can fail when clients connect to different websocket instances.
