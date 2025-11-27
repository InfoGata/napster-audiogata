# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

This is an AudioGata plugin for Napster, built with Preact, shadcn/ui, Tailwind CSS v4, and Vite.

### Build Commands
- `npm run build` - Builds both the options page and plugin (runs build:options && build:plugin)
- `npm run build:options` - Builds the options/configuration UI using vite.config.ts
- `npm run build:plugin` - Builds the main plugin code using plugin.vite.config.ts

### Testing
- `npm test` - Run tests using Vitest with jsdom environment

### Development
No development server commands are configured. The plugin uses a two-part build system that generates static files for distribution.

## Architecture Overview

### Plugin Structure
This is an AudioGata plugin that provides Napster streaming integration. AudioGata is a music streaming aggregator platform that loads plugins to interface with different music services.

### Key Components

**Main Plugin (`src/index.ts`)**
- Core plugin logic implementing AudioGata's plugin API
- Handles authentication via OAuth2 flow with Napster API
- Implements search, browse, and streaming functionality
- Uses ky HTTP client for API requests with token refresh logic
- Manages local storage for auth tokens and API keys

**Options UI (`src/App.tsx` & `src/options.tsx`)**
- Preact-based configuration interface using shadcn/ui components
- Handles OAuth login flow via popup window
- Allows users to configure custom API keys
- Built as separate HTML page loaded by AudioGata
- Uses Tailwind CSS v4 with @tailwindcss/vite plugin

**API Integration**
- Napster API v2.2 integration for music search/streaming
- Token-based authentication with automatic refresh
- Support for both default and custom API keys
- Handles user playlists, top tracks, search across artists/albums/tracks
- API documentation available in `napster_documentation.html`

### Build Configuration

**Dual Vite Configs:**
- `vite.config.ts` - Builds options UI with Preact and Tailwind CSS v4 support
- `plugin.vite.config.ts` - Builds main plugin as single ES module
- `vitest.config.ts` - Test configuration with jsdom environment and coverage reporting
- Both build configs use `vite-plugin-singlefile` for standalone distribution

**UI Components:**
- Uses shadcn/ui components adapted for Preact (via @radix-ui primitives)
- Configuration in `components.json` for shadcn CLI compatibility
- Theme provider from `@infogata/shadcn-vite-theme-provider`

### Plugin Distribution
- Built files output to `dist/` directory
- `manifest.json` defines plugin metadata for AudioGata
- Distributed via CDN (jsdelivr) for easy installation
- Plugin loads as standalone JavaScript module in AudioGata's sandboxed environment

### Authentication Flow
1. Plugin requests authentication via options page
2. User login opens OAuth popup to Napster
3. Auth code exchanged for tokens via proxy server or direct API
4. Tokens stored locally and used for authenticated requests
5. Automatic token refresh handling for expired sessions