# Contributing to Syrian Zone (دليل المساهمة في مشروع المساحة السورية)

Thank you for your interest in contributing to **Syrian Zone**! We welcome contributions from developers, designers, translators, and community members of all skill levels.

---

## 🚀 Getting Started (دليل التطوير السريع)

Before submitting code changes or opening pull requests, please read our developer setup and asset storage documentation:

1. **[Developer Setup & Quickstart Guide](docs/getting-started/development.md)**: Instructions on cloning the repo, running migrations, database seeders, and starting the local development server (`bun run dev` & `php artisan serve`).
2. **[Cloudflare R2 Asset Storage Guide](docs/reference/asset-storage.md)**: Details on how static assets, candidate avatars, GeoJSON maps, and brand kit downloads are hosted on Cloudflare R2 CDN and how to work with them in local development.

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
4. **Commit & Push**:
   ```bash
   git commit -m "feat(module): description of changes"
   git push origin feature/my-new-feature
   ```
5. **Open Pull Request**: Submit a Pull Request targeting the `main` branch with a concise summary of your changes.

---

## 📜 Code of Conduct & Licensing

This project is open-source software licensed under the **[MIT License](LICENSE)**. By contributing, you agree that your contributions will be licensed under the same terms.
