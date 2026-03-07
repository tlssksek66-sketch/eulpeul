# CLAUDE.md

## Project Overview

**eulpeul** is a Jekyll-based static site intended for deployment via GitHub Pages. The project is in its initial stage — no site content, templates, or build configuration have been added yet.

- **License**: Eclipse Public License v2.0 (EPL-2.0)
- **Static Site Generator**: Jekyll (planned, per `.gitignore` configuration)
- **Deployment Target**: GitHub Pages

## Repository Structure

```
eulpeul/
├── .gitignore      # Jekyll/GitHub Pages ignores
├── LICENSE          # EPL-2.0
└── CLAUDE.md        # This file
```

### Planned Jekyll Structure (not yet created)

When Jekyll content is added, expect the standard layout:

```
├── _config.yml      # Jekyll site configuration
├── _layouts/        # HTML layout templates
├── _includes/       # Reusable HTML partials
├── _posts/          # Blog posts (YYYY-MM-DD-title.md)
├── _sass/           # Sass partials
├── assets/          # Static assets (CSS, JS, images)
├── Gemfile          # Ruby dependencies
├── index.md         # Site homepage
└── _site/           # Generated output (gitignored)
```

## Development Setup

### Prerequisites

- Ruby (2.7+)
- Bundler (`gem install bundler`)
- Jekyll (`gem install jekyll`)

### Local Development (once Jekyll is configured)

```bash
bundle install          # Install dependencies
bundle exec jekyll serve  # Serve locally at http://localhost:4000
```

## Build Commands

| Command | Description |
|---------|-------------|
| `bundle install` | Install Ruby dependencies |
| `bundle exec jekyll build` | Build the static site to `_site/` |
| `bundle exec jekyll serve` | Serve site locally with live reload |

## Git Conventions

- **Default branch**: `main`
- **Commit messages**: Use clear, descriptive messages in imperative mood
- **Branch naming**: Feature branches should be descriptive of the change

## Key Notes for AI Assistants

- This is an early-stage repository with minimal content
- The `.gitignore` is pre-configured for Jekyll/GitHub Pages — do not modify without reason
- The project uses EPL-2.0 licensing; ensure any added dependencies are license-compatible
- Generated files (`_site/`, `.jekyll-cache/`) are gitignored and should never be committed
- `Gemfile.lock` is intentionally gitignored per GitHub Pages conventions
