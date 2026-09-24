# IMRAN ARAIN KARYANA

A complete offline-first Point of Sale, Billing, Udhaar (credit) and Inventory management app for a grocery / kiryana store. 100% client-side — no server, no API keys. All data lives in your browser (IndexedDB) and is fully portable via JSON backup/restore.

Built with Next.js 15 (App Router) + TypeScript + Tailwind + shadcn-style UI + Dexie.js (IndexedDB) + jsPDF.

---

## 1. Folder Structure

```
Imranarain/
├─ app/
│  ├─ layout.tsx                 # Root layout (shell + providers)
│  ├─ providers.tsx              # Theme, Toaster, Command Palette + global hotkeys
│  ├─ globals.css                # shadcn theme vars (light/dark), print/thermal CSS
│  ├─ page.tsx                   # /  Dashboard (stats + 7-day sales chart)
│  ├─ bill/new/page.tsx          # /bill/new  POS / billing screen
│  ├─ bills/page.tsx             # /bills  Bill history, view/PDF/print/discharge
│  ├─ customers/page.tsx         # /customers  Customer list + add
│  ├─ customers/[id]/page.tsx    # Customer profile, statement, add payment, WhatsApp, create bill
│  ├─ udhaar/page.tsx            # /udhaar  Outstanding balances, payment log, PDF/CSV
│  ├─ products/page.tsx          # /products  CRUD, stock adjust, import/export
│  ├─ reports/page.tsx           # /reports  Filterable PDF/CSV reports
│  ├─ downloads/page.tsx         # /downloads  All PDF/print/CSV download centers
│  └─ settings/page.tsx          # /settings  Store info, logo, invoice, backup/restore, demo data
├─ components/
│  ├─ layout/                    # sidebar, shell, nav data
│  ├─ command-palette.tsx        # Ctrl+K search bar
│  ├─ invoice/                   # InvoiceView (58mm/80mm/A4) + actions (PDF/Print/WhatsApp)
│  ├─ customers/add-customer-dialog.tsx
│  └─ ui/                        # shadcn-style: button, card, input, dialog, sheet, tabs,
│                                # table, toast, stat-card, chart (SVG), switch, badge, etc.
├─ db/
│  ├─ database.ts                # Dexie schema (IndexedDB)
│  ├─ settings.ts / products.ts / customers.ts / bills.ts / payments.ts / stats.ts / seed.ts
├─ lib/
│  ├─ pdf.ts                     # jsPDF invoice + all reports
│  ├─ print.ts                   # receipt HTML printing (58/80/A4)
│  ├─ whatsapp.ts                # click-to-chat templates
│  ├─ backup.ts                  # export/validate/import/clear-all
│  ├─ csv.ts, reports.ts, validation.ts, logo.ts, format.ts, utils.ts
├─ hooks/                        # use-settings, use-debounce, use-hotkey
├─ types/index.ts                # All TypeScript models
├─ public/manifest.webmanifest
└─ package.json
```

---

## 2. Install Commands

```bash
npm install
```

## 3. NPM Dependencies

Runtime: `next` 15.5.26, `react` 19, `dexie`, `jspdf`, `jspdf-autotable`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `next-themes`, multiple `@radix-ui/react-*` primitives (dialog, alert-dialog, dropdown-menu, tabs, switch, sheet, slot, label, separator, toast).

Dev: `typescript`, `tailwindcss` 3.4, `eslint` 8 + `eslint-config-next`.

## 4. Local Development

```bash
npm run dev      # http://localhost:3000
```

## 5. Production Build

```bash
npm run build    # lint + type-check + static generation
npm run start    # serve the production build
```

## 6. Vercel Deployment

1. Push the project to GitHub.
2. On Vercel, **Import Project** → the repo (framework: Next.js, all defaults).
3. Deploy. The app builds as fully static pages — no env vars or database needed.

## 7. Database / Storage

- Data is stored **entirely in the browser** using IndexedDB (database name `imran-arain-karyana`) via the Dexie wrapper.
- Tables: `products`, `customers`, `bills`, `billItems`, `payments`, `settings`, `stockMovements`.
- A bill is saved in one atomic transaction: invoice-number check → stock decrement → stock movement log → bill + items + payment.
- Udhaar balance = opening balance + all bill totals − all payments.
- Internet is not required and data never leaves the device.

## 8. Backup / Restore

- **Backup:** Settings → Data → Download Backup. Creates `IMRAN-ARAIN-KARYANA-BACKUP-YYYY-MM-DD.json` containing every table.
- **Restore:** Import the JSON file. It is validated first, then all existing data is replaced.
- **Clear Data:** Type `DELETE` in the confirmation box to wipe everything.
- Store backups somewhere safe (USB / Google Drive / WhatsApp to yourself) — clearing browser data deletes the app database.

## 9. Known Limitations

- Data is per-browser/device only — no cloud sync or multi-device sharing. Backup JSON is the way to move data.
- WhatsApp reminders only work on devices with WhatsApp; numbers must include country code (a leading `0` becomes `92`).
- PDF/print output depends on the browser's print dialog; use **Print** inside receipt dialogs for exact thermal sizes (58mm/80mm) on a real thermal printer (set print dialog margins to None / default for best results).
- First visit shows an empty database; use Settings → Demo Data to load sample products/customers.
```