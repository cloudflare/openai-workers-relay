This is a relay server for usage with [OpenAI's realtime API](https://platform.openai.com/docs/guides/realtime/quickstart). You can use this repo as a starting point for incorporating the realtime api into your own project. When deployed to a Cloudflare Worker, you can connect to it from a frontend (like a web app) without needing your users to have or share their own OpenAI api key.

_NB: This project is considered beta, because the underlying OpenAI Realtime API is currently in beta. We will work on keeping this in sync with the work at OpenAI, but there may be some lag. File an issue if you have any problems!_

## Usage

The included [server](./src/index.ts) should work out of the box with the official example [openai-realtime-console](https://github.com/openai/openai-realtime-console/) application. You can copy paste code out of it into your Worker, or just deploy this one directly. Feel free to modify the code and configuration to fit your needs.

### Add an OPENAI_API_KEY to your secrets

To actually connect to OpenAI, you'll need to add your OpenAI API key to the secrets for your worker. First, generate an API key from your OpenAI console at https://platform.openai.com/api-keys.

In local development, create a file called `.dev.vars` in the root of the project with the following:

```
OPENAI_API_KEY=<your key here>
```

This should let you develop and test your code locally. The API key will be available in your request's `env` object as `env.OPENAI_API_KEY`.

In production, you'll need to add an `OPENAI_API_KEY` to your Worker's secrets. After that, you can add it to your secrets by running the following command:

```sh
npx wrangler secret put OPENAI_API_KEY
```

Then, after you deploy your project, the API key will be available in your request's `env` object as `env.OPENAI_API_KEY`.

### Add authorisation, rate limiting, or anything else!

We recommend that you add a layer of authorisation on top of this relay server. This will prevent any random person from using relay, and your OpenAI key! If you're deploying this relay server as part of another Workers project, then it should be fairly straightforward to leverage the authorisation and rate limiting already in place there.

If you're deploying this server to a completely different domain, then you'll have to add a layer of auth on top of the WebSocket connection. Since the standard WebSocket api doesn't support adding cookies or any other headers, you'll have to layer it on top of the URL/protocols when making the connection. For example, you could generate an encrypted short lived token in your existing webapp, add it to the WebSocket url's query params, and then decode it in the Worker to verify the provenance of the request.

### Develop locally

To develop locally, you can run `npm start` and then connect to the local server at `ws://localhost:8787`.

### Deploy to production

To deploy to production, you can run `npm run deploy` and then connect to the production server at `wss://<your-worker-name>.<username>.workers.dev` (or any custom routes/domains [that you setup in `wrangler.toml`](https://developers.cloudflare.com/workers/configuration/routing/routes/#set-up-a-route-in-wranglertoml))

## Show us what you made!

We'd love to see what you create with this. Tweet us [@cloudflaredev](https://twitter.com/cloudflaredev) and let us know what you're building!

## Thanks

![braintrust](https://github.com/user-attachments/assets/5eb1bb08-bdd0-462d-816c-83c03d618add)

We built this in collaboration with the folks at [Braintrust](https://www.braintrust.dev/).
