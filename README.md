<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# EOS Inventory Management

This repository contains the inventory management web app and build configuration for local development and Netlify deployment.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`

### Native development

Use the native Vite/Express dev server for live reload and faster local development.

- Start the app:
  `npm run dev`
- Open in the browser:
  `http://localhost:3000`

### Local production server

Build the full production output and run the local server using the compiled `dist` files.

- Build the app:
  `npm run build`
- Start the production server:
  `npm run serve:prod`
- Open in the browser:
  `http://localhost:3000`

### LAN access

The local development server listens on `0.0.0.0`, so other devices on the same network can reach it using your machine's IP address.

- Start the app for LAN access:
  `npm run serve:lan`
- Open from another device:
  `http://<your-local-ip>:3000`

> If Windows Firewall is enabled, allow the app access for private networks.

### Secure LAN access

For safer LAN deployment, enable Basic Auth by creating a `.env` file in the project root with:

```env
LAN_AUTH_USER=yourusername
LAN_AUTH_PASS=yourpassword
```

Then start the server normally:

- `npm run serve:lan` for development
- `npm run serve:prod` for the local production server

The app will require the username/password before allowing access.

### Tunnel access

Expose your local app to the internet using a tunnel service.

1. Start the app locally:
   `npm run dev`
2. Open a tunnel in another terminal:
   `npm run tunnel:dev`

Localtunnel will print a public URL such as `https://random-name.loca.lt`.

For production tunnel access:

1. Build the app: `npm run build`
2. Start the production server: `npm run serve:prod`
3. Open the tunnel separately:
   `npx localtunnel --port 3000`

This lets developers or reviewers access your local deployment without a separate hosting service.

## Build for Production

- Build the application:
  `npm run build`

## Deploy to Netlify

The project includes a `netlify.toml` file configured for Netlify builds.

### Automatic deploy on GitHub push

A GitHub Actions workflow is included in `.github/workflows/netlify-deploy.yml`.
When code is pushed to `main` or `master`, the workflow will:

- install dependencies
- build the app
- deploy the `dist` folder to Netlify

### Setup

1. Create a Netlify site and connect your repository.
2. Add the following GitHub repository secrets:
   - `NETLIFY_AUTH_TOKEN`
   - `NETLIFY_SITE_ID`
3. Confirm the workflow file exists at `.github/workflows/netlify-deploy.yml`.

### Manual deploy

You can also deploy manually with:

```bash
NETLIFY_AUTH_TOKEN=your_token NETLIFY_SITE_ID=your_site_id npm run deploy:netlify
```

### Netlify settings

- Build command: `npm run build`
- Publish directory: `dist`
- SPA routing is handled by `netlify.toml`.

## Run independently of Visual Studio / VS Code

- Build and start the production server locally:
  `npm run serve:prod`
- Or start it in a detached Windows process:
  `npm run serve:detached`
