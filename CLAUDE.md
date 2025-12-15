# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Cadê minhas fotos?" is a browser-based facial recognition tool that runs 100% offline. It allows users to find specific faces across large photo collections using biometric matching with face-api.js. All processing happens client-side in the browser with no server required.

## Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS with custom Kokonut-inspired design system
- **AI/ML**: face-api.js (v0.22.2) loaded via CDN
  - Models: SSD MobileNet v1 (default) + Tiny Face Detector (performance mode)
  - Face recognition via 128-dimensional descriptors
- **Deployment**: Docker with multi-stage build (Node.js build → Nginx serve)

## Development Commands

```bash
# Start development server (hot reload on http://localhost:5173)
npm run dev

# Build for production (outputs to /dist)
npm run build

# Preview production build locally
npm run preview
```

## Docker Deployment

```bash
# Build Docker image
docker build -t cade-minhas-fotos .

# Run container
docker run -p 80:80 cade-minhas-fotos
```

The Dockerfile uses a multi-stage build: Node.js Alpine for building, then Nginx Alpine for serving the static files with gzip compression enabled.

## Architecture

### Core Workflow (3-Step Process)

1. **Target Definition** (`handleTargetUpload`): User uploads reference photo → face-api.js extracts 128D biometric descriptor
2. **Source Selection** (`handleBatchUpload`): User selects photo collection → files queued in memory as object URLs
3. **Execution** (`runFilter`): Batch processing with euclidean distance comparison against target descriptor

### Key Technical Details

- **Biometric Matching**: Uses euclidean distance between face descriptors (lower = better match)
  - Internal capture threshold: 0.7 (stores all potential matches)
  - User-adjustable display threshold: 0.3-0.8 (post-processing filter)

- **Performance Optimizations**:
  - Target photos >1280px are downscaled before processing (src/App.jsx:144-152)
  - Batch processing yields every 5 images to prevent UI blocking (src/App.jsx:245)
  - Explicit image cleanup for garbage collection (src/App.jsx:248-249)
  - Model switching: `useTinyModel` toggles between SSD (precise) and Tiny (fast)

- **State Management**: Plain React state (no Redux/Context)
  - `allMatches`: Stores ALL captured candidates with distance scores
  - `visibleMatches`: useMemo-filtered view based on `displayThreshold` slider
  - This allows real-time threshold adjustment without re-processing

### Component Structure

- **Kokonut Design System** (src/App.jsx:14-67): Custom UI components
  - `KCard`: Glassmorphic card with active states and gradients
  - `KButton`: 4 variants (primary, secondary, danger, outline)
  - `KBadge`: Status indicators with icons

- **Main App Component**: Single-file React app (src/App.jsx)
  - Tutorial modal on first visit
  - Sticky navbar with offline badge
  - 3-column responsive grid (Target → Source → Action)
  - Dynamic threshold slider for result filtering
  - Gallery view with hover previews and download links

### face-api.js Integration

Models are loaded from jsdelivr CDN on mount (src/App.jsx:98-127):
- SSD MobileNet v1 (face detection)
- Face Landmark 68 Net (alignment)
- Face Recognition Net (descriptor extraction)
- Tiny Face Detector (fast mode alternative)

Detection is handled with two options:
```javascript
// Precise mode (default)
new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 })

// Fast mode (performance)
new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 })
```

## UI/UX Patterns

- **Progressive Enhancement**: UI blocks unlock sequentially (Target → Source → Action)
- **Dark Theme**: Zinc-950 base with indigo accent colors
- **Animations**: Tailwind's animate-in utilities + custom progress keyframes
- **Responsive**: Mobile-first grid (1 col → 3 col on lg breakpoint)
- **Accessibility**: Disabled states with blur/opacity, hover states, semantic HTML

## Important Notes

- **Privacy First**: All processing is client-side. No uploads to servers.
- **Memory Management**: Large batches may cause browser memory issues. The app uses URL.revokeObjectURL to clean up, but advise users to process in chunks if needed.
- **Browser Compatibility**: Requires modern browser with WASM support for face-api.js
- **Portuguese Language**: All UI text is in Portuguese (Brazilian)

## File Structure

```
/
├── src/
│   ├── App.jsx          # Main application (550+ lines, single component)
│   ├── main.jsx         # React entry point
│   └── index.css        # Tailwind directives
├── index.html           # HTML shell
├── vite.config.js       # Vite bundler config
├── tailwind.config.js   # Tailwind customization (custom animations)
├── postcss.config.js    # PostCSS with autoprefixer
├── Dockerfile           # Multi-stage build (Node → Nginx)
├── nginx.conf           # Production server config
└── package.json         # Dependencies and scripts
```
