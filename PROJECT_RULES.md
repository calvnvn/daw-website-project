# 🌟 DAW Corporate Website & CMS - Project Rules & Guidelines

Welcome to the **DAW Corporate Website & CMS** workspace. This document serves as the **Source of Truth** for all developers, AI coding assistants (Vibe Coders), and collaborators working on this project. 

Whenever you start a new task, refer to these rules to ensure consistency, scalability, and adherence to our premium corporate standards.

---

## 1. 🏗️ Tech Stack & Architecture

### Frontend (`/daw-frontend`)
* **Framework**: React.js with Vite bundler.
* **Language**: TypeScript (Strict typing is enforced).
* **Styling**: Tailwind CSS + Shadcn UI primitives.
* **State Management**: React Context API (domain-specific contexts like `HomeContext`, `AboutContext`, `AuthContext`).
* **Routing**: React Router DOM (with Lazy Loading for performance).

### Backend (`/daw-backend`)
* **Framework**: Node.js with Express.js.
* **Database/ORM**: Sequelize ORM (MySQL/PostgreSQL).
* **Authentication**: JWT (JSON Web Tokens) with Role-Based Access Control (RBAC).

---

## 2. 📂 Directory Structure Standards (Frontend)

We strictly follow a modular, domain-driven directory architecture to avoid bloated root folders.

* **`src/pages/admin/`**: Must remain clean. All administrative pages are grouped into domain-specific subdirectories (e.g., `/projects`, `/news`, `/investments`, `/home`, `/about`). 
* **`src/components/admin/`**: Complex components used exclusively in the admin dashboard (e.g., Live Previews, Manager UI blocks) must be placed in their corresponding domain folders (e.g., `admin/home`, `admin/about`).
* **`src/components/` (Root)**: Reserved ONLY for shared, public-facing, or generic components (`Footer.tsx`, `Hero.tsx`, `ScrollReveal.tsx`).
* **`src/components/ui/`**: Reserved for raw Shadcn UI primitives.

**🚫 Anti-Pattern**: Never dump massive >300-line form files directly into the root of `/pages/admin` or `/components`. Break them down.

---

## 3. 🎨 UI/UX Design System & Aesthetics

Our goal is a **Premium, Executive, and High-Fidelity** corporate aesthetic.

### Typography
* **Primary (Headlines)**: `Playfair Display` (Serif). Used for main titles and section headers to project elegance and establishment.
* **Secondary (Body & UI)**: `Plus Jakarta Sans` (Sans-serif). Used for readability, buttons, and system text.

### Brand Colors & Utility
* **DAW Green**: The core brand color. Used for primary buttons, active states, and accents.
* **DAW Yellow**: Used for secondary accents or hover states.
* **Slate Palette**: Heavy use of `bg-slate-50`, `bg-slate-100`, and `text-slate-900`/`500` for a clean, modern corporate background and typography contrast instead of pure blacks and whites.

### The "Dual-View Toggle" Pattern
All CMS manager modules MUST implement the **Dual-View Toggle** pattern:
* Administrators must be able to switch between **Form Mode** (data entry) and **Live Preview Mode** (simulated final website render).
* **UI Standard**: Use a pill-shaped toggle switch (e.g., `bg-slate-100` container with `shadow-inner` and animated sliding indicators) for switching tabs gracefully.

---

## 4. ⚙️ Backend Workflows & The Notification Engine

### The Approval Lifecycle
All core content publishing goes through a multi-tier approval system handled by `approvalController.js`.
* **State Flow**: `DRAFT` -> `PENDING` -> (`APPROVED` or `REJECTED`).

### Corporate Mailer (`mailer.js`)
* Emails must not look like raw text. We use a **High-Fidelity HTML Corporate Template**.
* Must include: Centered corporate logo, `Playfair Display` headers, card-based body layouts, distinct color-coded status badges, and a bilingual confidentiality footer.
* Rejections must include a clearly styled "Alert Box" detailing the reviewer's reasoning.

### The Anti-Spam Filter (Silent Publish)
To prevent overwhelming executive inboxes:
* **Silent Modules**: Routine approvals for minor modules (e.g., `HomeSettings`, `Menu`, `HeroSlides`) will **skip** sending an `APPROVED` email.
* **Vocal Modules**: High-impact items (e.g., `Project`, `NewsArticle`) will send `APPROVED` emails.
* **Always Send**: `NEW_REQUEST` and `REJECTED` notifications are always dispatched to ensure workflow continuity.

---

## 5. 💻 Coding Conventions & Best Practices

### 1. Absolute Path Aliasing (CRITICAL)
**Never** use deep relative imports like `../../../../components/Button`.
* **Frontend**: Always use the `@/` alias mapped to `daw-frontend/src`. 
  * *Example*: `import { Button } from "@/components/ui/button";`
  * *Example*: `import HeroManager from "@/components/admin/home/HeroManager";`

### 2. Component Size & Clean Code
* Keep components lean. If a file exceeds 400 lines, extract its complex inner logic or sub-forms into smaller helper components within the same domain folder.
* Use `useCallback` and `useMemo` for heavy calculations or data fetching methods to prevent unnecessary React re-renders.

### 3. Git Commits
Use the **Conventional Commits** format.
* `feat:` for new features.
* `fix:` for bug fixes.
* `refactor:` for code restructuring without changing functionality.
* `style:` for UI/CSS tweaks.
* *Example*: `refactor: reorganize admin folder structure by domain`

---

## 🤖 Note to AI Assistants (Vibe Coders)
When reading this file:
1. Always analyze the requested task against the established **Directory Structure Standards** and **UI/UX Aesthetics**.
2. If generating new UI, prioritize `Plus Jakarta Sans` and `Playfair Display`.
3. Validate all imports using `@/` path aliasing before providing code snippets.
4. Aim to impress with premium, well-spaced, and cleanly styled designs rather than basic MVPs.
