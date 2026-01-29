
# Cloudflare Pages Functions & D1 Setup

This folder contains the backend logic for the Shisanshui game.

## Deployment Instructions

1. **Move Files**: Copy the `functions` folder inside this directory to the **root** of your GitHub repository.
2. **Push to GitHub**: Commit and push changes.

## Database Setup (Crucial Step)

Cloudflare Pages requires you to manually bind the database in the dashboard.

1. **Create D1 Database**:
   - Go to Cloudflare Dashboard > Workers & Pages > D1.
   - Click "Create", name it `shisanshui-db`.

2. **Bind to Pages**:
   - Go to Cloudflare Dashboard > Workers & Pages > [Your Pages Project].
   - Go to **Settings** > **Functions**.
   - Scroll to **D1 Database Bindings**.
   - Click **Add binding**.
   - **Variable name**: `DB` (Must be exactly this, uppercase).
   - **D1 Database**: Select `shisanshui-db`.
   - Save.

3. **Initialize Tables**:
   - Once the latest deployment finishes, open your browser.
   - Visit: `https://your-project-name.pages.dev/api/init_db`
   - You should see a JSON success message indicating tables were created.

## API Endpoints

- `GET /api/status`: Check server and DB health.
- `GET /api/init_db`: Create database schema (run once).
- `POST /api/join`: Join a table (Requires JSON body: `{ "tableId": 1, "seatId": "north" }`).
