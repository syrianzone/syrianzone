# Contributing to Syrian Zone (دليل المساهمة في مشروع المساحة السورية)

Thank you for your interest in contributing to **Syrian Zone**! We welcome contributions from developers, designers, translators, and community members of all skill levels.

---

## 🚀 Getting Started (دليل التطوير السريع)

Before submitting code changes or opening pull requests, please read our core engineering docs:

1. **[AGENTS.md](AGENTS.md)**: Non-negotiable conventions (accessibility, RTL, theming, layering, API client) and common pitfalls.
2. **[Documentation Index (`docs/INDEX.md`)](docs/INDEX.md)**: Task-oriented router to all architecture, module, reference, and runbook docs.
3. **[Developer Setup & Quickstart Guide](docs/getting-started/development.md)**: Cloning the repo, migrations, database seeders, and starting the local dev server (`bun run dev`).
4. **[Cloudflare R2 Asset Storage Guide](docs/reference/asset-storage.md)**: How static assets, candidate avatars, GeoJSON maps, and brand kit downloads are hosted on Cloudflare R2 CDN and worked with locally.

---

## 🛠️ How to Contribute (كيفية المساهمة)

### 1. Reporting Bugs & Suggesting Features
- Search existing [GitHub Issues](https://github.com/syrianzone/syrianzone/issues) before opening a new issue.
- Provide a clear description, steps to reproduce, and screenshots if applicable.

### 2. Pull Request Workflow
1. **Fork & Branch**: Create a new branch off `main` for your feature or bug fix:
   ```bash
   git checkout -b feature/my-new-feature
   ```
2. **Follow Code Conventions**:
   - Backend: Follow Laravel standard conventions (`app/`, PSR-12 formatting).
   - Frontend: Use React 19 + TypeScript (`resources/js/`) with TailwindCSS utility classes.
3. **Seed Dev Data**: Use `php artisan db:seed --class=StagingSeeder` to test your changes against realistic mock data.
4. **Run the Quality Gate**: Run [`bash scripts/gate.sh`](scripts/gate.sh) before opening a PR (runs `tsc`, ESLint, Vitest, Vite client + SSR build, answer-card tests, Pest, and advisory Pint). For UI changes, also run `python3 scripts/a11y_axe_audit.py --base http://localhost:8000`.
5. **Commit & Push**:
   ```bash
   git commit -m "feat(module): description of changes"
   git push origin feature/my-new-feature
   ```
6. **Open Pull Request**: Submit a Pull Request targeting the `main` branch with a concise summary of your changes.

---

## 📜 Code of Conduct & Licensing

This project is open-source software licensed under the **[MIT License](LICENSE)**. By contributing, you agree that your contributions will be licensed under the same terms.
