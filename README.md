<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/9b40e173-ecc0-4670-9e5a-c534eb251603

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app in development:
   `npm run dev`

## Run independently of Visual Studio / VS Code
- Build and start the production server:
  `npm run serve:prod`
- Or start it in a detached Windows process so it keeps running after the editor closes:
  `npm run serve:detached`
