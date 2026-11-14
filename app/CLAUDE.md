# CLAUDE.md — 文獻回顧加速器 (Research Accelerator)

Rules for implementing Figma designs (via the Figma MCP server) in this codebase.

## Project at a glance

- Single-page React 19 + TypeScript app, built with **Vite 6**, deployed to **GitHub Pages** (`.github/workflows/deploy.yml`, on push to `main`; Vite `base: '/-/'`).
- Generated from Google AI Studio; AI calls go to Gemini (`@google/genai`, model `gemini-2.5-flash`) in `services/geminiService.ts`.
- UI language is Traditional Chinese with an English toggle (`showEnglish`).
- No router, no state library, no tests, no Storybook, no lint config.
- The app lives in `app/`; run npm commands from there. `素材/` (art assets) and `文件/` (PDF documents) at the repo root are unrelated content — not part of the app.

```
index.html              Tailwind CDN + theme tokens, Google Fonts, global CSS, importmap
index.tsx               React root
App.tsx                 Page shell, all top-level state, search/load-more, export, localStorage
types.ts                Domain types (Paper, ResearchSynthesis, MatrixAnalysis, SortOption…)
components/             Flat folder, one component per file (default export)
  PaperCard.tsx           Card per paper (+ inline MethodologyBadge sub-component)
  FilterSidebar.tsx       Sort / methodology filter / language toggle
  SynthesisCard.tsx       AI synthesis summary
  MatrixView.tsx          Comparison matrix + AI analysis (full-screen view)
  CitationMapModal.tsx    Modal: ancestors/descendants citation map
services/geminiService.ts  API key handling + Gemini prompts/JSON schemas
```

## 1. Design tokens

There is **no token file or token pipeline**. Tokens live in the inline Tailwind CDN config in `index.html`:

```js
tailwind.config = {
  theme: { extend: {
    colors: {
      primary: '#2563EB',   // royal blue – actions, selected state, headings
      secondary: '#64748B', // slate
      accent: '#F59E0B',    // amber – highlights
      background: '#F8FAFC',
      paper: '#FFFFFF', surface: '#FFFFFF',
      ink: '#0F172A',
    },
    fontFamily: {
      sans: ['Inter', ...],              // UI
      serif: ['Merriweather', ...],      // reading text, abstracts
      display: ['Playfair Display', ...] // headings
    },
    boxShadow: {
      academic: '0 2px 10px rgba(0,0,0,.05), 0 10px 25px rgba(0,0,0,.05)',
      hover: '0 10px 30px rgba(37,99,235,.1)',
    },
  }},
}
```

Rules:
- Map Figma colors to these semantic names first (`bg-primary`, `text-ink`, `bg-surface`, `shadow-academic`). Fall back to Tailwind's default `slate-*` scale for neutrals (the de-facto grey palette: `text-slate-500/400/600/800`, `border-slate-200/100`, `bg-slate-50`).
- Status/category colors use Tailwind defaults in a `50 / 700 / 100` triplet (`bg-blue-50 text-blue-700 border-blue-100`); see `MethodologyBadge` in `components/PaperCard.tsx`.
- A new token goes into the `tailwind.config` block in `index.html` — don't hardcode hex values in `className`.
- Spacing, radius and type scale are Tailwind defaults. Common: cards `rounded-xl p-6`, inner panels `rounded-lg p-5`, pills `rounded-full`, small labels `text-xs uppercase tracking-widest font-bold`, micro labels `text-[10px]`.

## 2. Components

- Function components typed as `React.FC<Props>`, with a `XxxProps` interface above the component and a default export:

```tsx
interface SynthesisCardProps {
  synthesis: ResearchSynthesis;
  showEnglish: boolean;
}
const SynthesisCard: React.FC<SynthesisCardProps> = ({ synthesis, showEnglish }) => { ... };
export default SynthesisCard;
```

- State lives in `App.tsx` and flows down as props + callbacks (`onToggleSelect`, `setSortOption`). Local UI state (`expanded`, `copied`, `showMap`) stays in the component via `useState`.
- Small helpers used by only one component are declared in the same file (e.g. `MethodologyBadge`).
- There is no shared primitive library (Button, Card, Modal). Buttons/cards are written inline with Tailwind classes. When a Figma design repeats a pattern across files, a new file in `components/` is fine — keep the flat structure.
- Domain types come from `types.ts`; add new shapes there.
- Every user-facing string needs both languages:

```tsx
{showEnglish ? 'Clear all search history?' : '確定要清除所有搜尋紀錄嗎？'}
// data fields are paired: paper.titleZh / paper.titleEn
```

## 3. Frameworks & build

| Concern | Tool |
|---|---|
| UI | React 19 (`react-jsx`), TypeScript 5.8 |
| Styling | Tailwind CSS via **CDN script** (`cdn.tailwindcss.com`), no PostCSS/tailwind.config.js |
| Icons | `lucide-react` |
| Bundler | Vite 6 + `@vitejs/plugin-react`; `@/*` alias → repo root |
| Env | `GEMINI_API_KEY` in `.env.local`, exposed as `process.env.API_KEY`; users can also enter a key at runtime (stored in `localStorage`) |

Commands: `npm install`, `npm run dev` (port 3000), `npm run build`, `npm run preview`. No lint or test scripts — `npm run build` is the only check.

Caveats:
- `index.html` also has an `importmap` pointing at esm.sh (left over from AI Studio). Vite bundles from `node_modules` anyway; keep the versions in both places in sync if you bump a dependency.
- `animate-in fade-in slide-in-from-*` classes are used (`SynthesisCard`, `CitationMapModal`), but the `tailwindcss-animate` plugin isn't loaded, so they do nothing. Use `transition-*` utilities or add the plugin if a design needs entrance animations.

## 4. Assets

- There are no local app images, an `assets/` or `public/` folder, or a CDN config. External resources: Tailwind CDN, Google Fonts, esm.sh.
- If a Figma design adds images, put them in `public/` (Vite serves them at `base` = `/-/`) or import them from a module so Vite hashes them. Don't use absolute `/img.png` paths — they break under the GitHub Pages base path.
- When the Figma MCP returns asset URLs (localhost source URLs), download and commit them; don't add a new icon package for them.

## 5. Icons

- Use **lucide-react** only, imported by name per file:

```tsx
import { Search, Sparkles, Loader2 } from 'lucide-react';
<Search size={20} className="text-slate-400" />
<Loader2 className="animate-spin" size={18} />
```

- Size via the `size` prop (14–20 inline, 28 for feature icons); color via `text-*` classes.
- Map Figma icons to the closest Lucide name (PascalCase, e.g. `BrainCircuit`, `FileSpreadsheet`). For a custom glyph with no Lucide match, use an inline SVG component in the same file.

## 6. Styling

- Utility-first Tailwind in `className`. No CSS Modules, styled-components or `.css` files.
- Global CSS is only the `<style>` block in `index.html` (body background/color, font smoothing, custom scrollbar).
- Conditional classes use template literals; there's no `clsx`:

```tsx
className={`relative bg-surface rounded-xl shadow-academic border transition-all duration-300
  ${isSelected ? 'border-primary ring-1 ring-primary/20 bg-blue-50/20' : 'border-transparent'}`}
```

- Recurring patterns:
  - Card: `bg-surface rounded-xl shadow-academic border border-slate-200 p-6/p-8`, hover `hover:shadow-hover`
  - Panel: `bg-paper p-5 rounded-lg border border-slate-200 shadow-sm`
  - Accent bar: `absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-indigo-500 to-accent`
  - Modal: `fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm`
  - Quote/summary: `font-serif text-lg leading-relaxed border-l-4 border-accent pl-6`
- Responsive: mobile-first Tailwind breakpoints, mostly `sm:` (flex-row, padding) and `md:`/`lg:` (show sidebar with `hidden md:block`, `md:grid-cols-3`, `lg:flex-row`). No container queries or custom breakpoints. Match Figma desktop frames at `lg`, and confirm the layout still stacks on mobile.
- No dark mode.

## 7. Figma → code workflow

1. `get_design_context` for the node, then `get_screenshot` for a visual reference.
2. Treat the output as a reference: rewrite it to this repo's conventions (Tailwind classes using the tokens above, `React.FC` + props interface, lucide icons, bilingual strings).
3. Reuse existing components (`PaperCard`, `SynthesisCard`, `FilterSidebar`, `MatrixView`, `CitationMapModal`) before creating new ones.
4. New colors/fonts/shadows go into `tailwind.config` in `index.html`; new types into `types.ts`.
5. Run `npm run build` to check, then compare against the screenshot.
