# Hisaabook

A business bookkeeping and ownership-tracking product concept for solo founders and teams. Product planning documents are in [`docs/`](docs/).

## Web app

The current frontend is a responsive Next.js dashboard prototype for a Pakistan-based small business. It uses the Next.js App Router, Tailwind CSS, Radix UI Dialog, Lucide icons, and Recharts.

### Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Current prototype scope

- Business overview with income, expenses, balances, and outstanding loans.
- Responsive navigation and transaction activity table.
- Income/expense trend chart with 7, 30, and 90-day controls.
- Ownership share overview, with an explicit note that ownership and contributions are separate.
- Add-transaction dialog with basic client-side entry and immediate display in recent activity.

The dashboard currently uses illustrative sample data and client-side state only. It does not persist records or implement authentication, collaboration, accounting calculations, or a backend. Product requirements are documented in [`docs/PRD.md`](docs/PRD.md), [`docs/FEATURES.md`](docs/FEATURES.md), [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md), and [`docs/USER_FLOWS.md`](docs/USER_FLOWS.md).
