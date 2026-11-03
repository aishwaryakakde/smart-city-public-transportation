# SmartTransport Dashboard

Smart city public transportation dashboard built with React, Vite, and Leaflet.

## Run locally

```sh
npm install
npm run dev
```

## Verify a production build

```sh
npm run lint
npm run build
```

## Deploy to Vercel

The project is configured for a static Vite deployment; no backend environment variables are required. From this project directory, run:

```sh
npx vercel --prod
```

Sign in when prompted. The first deployment creates a project and prints its public URL; later deployments update that project. Deploy from this directory only, not from its parent folder.

The route planner, bus positions, schedules, and traffic levels are demo data. The map uses OpenStreetMap tiles. A real-time service requires a transit/GPS provider and a backend API.
