# Now That's Delicious

Now That's Delicious is a full-stack restaurant directory where people can
discover places, search by name or description, browse nearby stores on a map,
leave reviews, and save favorites. Registered users can also create and manage
their own store listings.

## Features

- User registration, login, logout, profile editing, and password reset
- Store creation and owner-only editing
- Image upload and server-side resizing
- Store pages with addresses, maps, tags, and reviews
- Full-text type-ahead search
- Geospatial search for stores within 10 km
- Interactive Google Maps markers and place autocomplete
- Favorite stores using hearts
- Top-store rankings based on average review scores
- Store pagination and tag filtering
- MongoDB-backed sessions and flash messages

## Tech Stack

- **Server:** Node.js, Express, Pug
- **Database:** MongoDB, Mongoose
- **Authentication:** Passport, passport-local-mongoose
- **Frontend:** Sass, browser JavaScript, Axios
- **Build:** Webpack, Babel, PostCSS
- **Maps:** Google Maps JavaScript, Places, and Static Maps APIs
- **Images:** Multer and Jimp
- **Email:** Nodemailer, Pug, Juice, and html-to-text

## Project Structure

```text
controllers/       Request handlers and application logic
config/            Database configuration
handlers/          Authentication, email, and error handling
models/            Mongoose models
public/            Browser JavaScript, Sass, images, fonts, and uploads
routes/             Express routes
views/              Pug pages, email templates, and mixins
helpers.js          Shared template helpers
server.js           Express application entry point
webpack.config.js   Frontend build configuration
```

## Prerequisites

- Node.js 22.x
- npm
- MongoDB or a MongoDB Atlas cluster
- A Google Maps API key
- SMTP credentials if password-reset email is required

The Google Cloud project should have these APIs enabled:

- Maps JavaScript API
- Places API
- Maps Static API

## Installation

Clone the repository and install its dependencies:

```bash
git clone https://github.com/edwinntaadu/now-thats-delicious.git
cd now-thats-delicious
npm install
```

Create a `.env` file in the project root:

```env
PORT=4000
NODE_ENV=development
DATABASE=mongodb://127.0.0.1:27017/now-thats-delicious
MAP_KEY=your_google_maps_api_key
SECRET=your_long_random_session_secret
KEY=now-thats-delicious.sid

# Optional until password-reset email is configured
MAIL_HOST=
MAIL_PORT=
MAIL_USER=
MAIL_PASS=
```

For MongoDB Atlas, use its `mongodb+srv://` connection string for `DATABASE`.
Do not commit `.env`.

## Running Locally

Build the browser assets:

```bash
npm run build
```

Start the application:

```bash
npm start
```

Open [http://localhost:4000](http://localhost:4000).

For development, run these in separate terminals:

```bash
npm run dev
```

```bash
npm run watch
```

## Available Scripts

| Command | Description |
| --- | --- |
| `npm start` | Starts the Express server |
| `npm run dev` | Starts the server with Nodemon |
| `npm run watch` | Rebuilds frontend assets when source files change |
| `npm run build` | Builds JavaScript and CSS into `public/dist` |
| `npm test` | Placeholder; automated tests are not configured yet |

## Main Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/` or `/stores` | Browse paginated stores |
| `GET` | `/stores/:slug` | View a store |
| `GET`, `POST` | `/add` | Create a store |
| `GET`, `POST` | `/stores/:id/edit`, `/add/:id` | Edit a store |
| `GET` | `/tags/:tag` | Filter stores by tag |
| `GET` | `/map` | Browse nearby stores on a map |
| `GET` | `/top` | View top-rated stores |
| `POST` | `/reviews/:id` | Add a review |
| `GET` | `/hearts` | View saved stores |
| `GET` | `/api/search?q=...` | Search stores |
| `GET` | `/api/stores/near?lat=...&lng=...` | Find nearby stores |
| `POST` | `/api/stores/:id/heart` | Toggle a favorite |

## Data Model

- **Store:** name, slug, description, tags, GeoJSON location, photo, author
- **User:** name, email, authentication data, reset token, hearted stores
- **Review:** author, store, text, rating, creation date

MongoDB text indexes support store search, and a `2dsphere` index supports
nearby-store queries.

## Deploying To Vercel

Import the GitHub repository into Vercel and use:

```text
Framework Preset: Express
Build Command: npm run build
Output Directory: leave empty
Node.js Version: 22.x
```

Add these environment variables to the Vercel project:

```text
DATABASE
MAP_KEY
SECRET
KEY
```

Add the `MAIL_*` variables when production email is configured. The MongoDB
Atlas network access list must also allow connections from the deployment.

### Production Storage Note

Uploaded images are currently written to `public/uploads`. This works locally,
but a Vercel Function does not provide persistent application storage. Existing
photos included in the deployment can be displayed, but new production uploads
may disappear after the function is replaced or restarted.

Before relying on production uploads, move image storage to a persistent service
such as Vercel Blob, Cloudinary, or Amazon S3 and save the resulting image URL
in MongoDB.

## Security Notes

- Keep `.env` and all API credentials out of Git.
- Restrict the Google Maps key to the deployed domain and required APIs.
- Use a strong, unique `SECRET` for production sessions.
- Use narrowly scoped MongoDB credentials.
- Configure upload size limits and persistent image storage before enabling
  public production uploads.

## License

Licensed under the [Apache License 2.0](LICENSE).
