# Veluga Website Crawl Tester

A powerful web scraping testing tool built with FastAPI and React, designed to analyze and extract content from websites using Crawl4AI.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11-blue.svg)
![React](https://img.shields.io/badge/react-19.2.0-blue.svg)
![Crawl4AI](https://img.shields.io/badge/crawl4ai-v0.8.0-orange.svg)

## 🌟 Features

- **Smart Content Extraction**: Automatically identifies and extracts main content from web pages
- **Multiple Output Formats**:
  - Content-only Markdown (clean, LLM-friendly)
  - Content-only HTML (main content without headers/footers/ads)
  - Full page Markdown
  - Full page HTML
- **Page Structure Analysis**: Identifies headers, navigation, main content, footers, and ads
- **LLM Analyzer**: Analyze crawled content using LLM models (Gemini, OpenAI)
- **Dashboard Persistence**: All menus and tasks (Batch, LLM Batch) remain active and maintain their state even when navigating between different views.
- **Link Collector**: Multi-depth link discovery with:
  - **Live Log Streaming (SSE)**: Real-time crawl progress displayed in the UI
  - **Performance Optimized Rendering**: Uses `React.memo` and pagination (200 links/page) to handle thousands of URLs without browser lag or crashes.
  - **Sitemap Tree View**: Hierarchical parent→child URL visualization
  - **Flat List View**: Traditional sortable table with category badges
  - CSV export and direct Batch Crawl integration
- **Batch Crawl**: High-volume URL processing pipeline:
  - Input via Link Collector selection or CSV upload (drag & drop)
  - Saves Full Markdown output as `.md` files to OS Downloads folder
  - File naming: `0001_Link_Text.md` (4-digit zero-padded)
  - Real-time per-link progress tracking with SSE streaming
  - Auto-creates timestamped output folder (`vcrawl_batch_YYYYMMDD_HHMMSS/`)
- **LLM Batch**: High-volume, cost-effective LLM processing using OpenAI Batch API:
  - Convert folder of `.md` files to `.jsonl` with custom system prompts
  - Select from lightweight reasoning models (`gpt-5-mini`, `gpt-5-nano`)
  - Submit batches, monitor status, and download results natively
  - Automatically renames files with `[STATUS: REJECTED]` based on prompt dropping rules
- **Premium Dark UI**: Modern, responsive interface with smooth animations

## 📋 Prerequisites

- Python 3.11 (Recommended for stability with `crawl4ai`)
- Node.js 22.11 or higher
- npm 11.4 or higher

## 🚀 Quick Start

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Install Playwright browsers (required for Crawl4AI):
```bash
playwright install
```

4. Start the backend server:
```bash
python main.py
```

The API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install npm dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## 📦 Project Structure

```
Vcrawl_mvp/
├── backend/
│   ├── main.py              # FastAPI application (SSE streaming)
│   ├── requirements.txt     # Python dependencies
│   ├── .env                 # API keys (GEMINI, OPENAI)
│   └── Dockerfile           # Backend Docker configuration
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── SearchBar.jsx
│   │   │   ├── ResultViewer.jsx
│   │   │   ├── LoadingSpinner.jsx
│   │   │   ├── SingleCrawlView.jsx
│   │   │   ├── LinkCollectorView.jsx  # SSE stream consumer
│   │   │   ├── LinkTreeView.jsx       # List/Sitemap toggle + Batch Crawl button
│   │   │   ├── SitemapTreeView.jsx    # Hierarchical tree view
│   │   │   ├── BatchCrawlView.jsx     # Batch crawl pipeline UI
│   │   │   ├── LLMAnalyzer.jsx
│   │   │   └── LLMAnalyzerView.jsx
│   │   ├── App.jsx         # Main application + sidebar
│   │   └── index.css       # Styling
│   ├── package.json
│   ├── nginx.conf          # Nginx proxy config
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## 🔧 API Endpoints

### POST `/api/v1/crawl`

Crawl and analyze a website.

**Request Body:**
```json
{
  "url": "https://example.com",
  "word_count_threshold": 10
}
```

**Response:**
```json
{
  "success": true,
  "markdown": "Full page markdown...",
  "html": "Full page HTML...",
  "content_only_markdown": "Main content markdown...",
  "content_only_html": "Main content HTML...",
  "structure": {
    "header": "Header HTML...",
    "navigation": "Navigation HTML...",
    "main_content": "Main content preview...",
    "footer": "Footer HTML...",
    "ads": ["Ad 1...", "Ad 2..."]
  },
  "metadata": {
    "url": "https://example.com"
  },
  "error_message": ""
}
```

### POST `/api/v1/batch-crawl` *(SSE)*

Crawl multiple URLs and save Full Markdown files to the OS Downloads folder.

**Request Body:**
```json
{
  "links": [
    { "href": "https://example.com/page", "text": "Page Title" }
  ],
  "output_folder_name": ""  // optional, auto-generated if empty
}
```

**SSE Events:**
```
type: log       → { message }
type: progress  → { current, total, url, filename, status, error? }
type: complete  → { folder_path, total_success, total_failed }
type: error     → { message }
```

**Output location:** `~/Downloads/vcrawl_batch_YYYYMMDD_HHMMSS/`  
**File naming:** `0001_Link_Text.md`, `0002_About_Us.md`, …

## 🎨 UI Features

### Dashboard Views

1. **Single Crawl** — Crawl a single URL, view results in multiple formats
2. **Link Collector** — Multi-depth link discovery with live streaming logs and sitemap view
3. **Batch Crawl** — Batch process multiple URLs, save Full Markdown to Downloads folder
4. **LLM Analyzer** — Analyze crawled content with Gemini or OpenAI models

### Single Crawl Tabs

1. **Content (MD)** - Main content in Markdown format (default)
2. **Content (HTML)** - Main content in HTML format
3. **Full Markdown** - Complete page in Markdown
4. **Full HTML** - Complete page in HTML
5. **Structure** - Page structure analysis

### Link Collector Features

- **Live Log Panel**: SSE-streamed crawl progress with pulsing green indicator
- **📋 List / 🗺️ Sitemap Toggle**: Switch between flat table and hierarchical tree
- **Sitemap Subtree Selection**: Clicking a parent checkbox selects/deselects all child URLs (with indeterminate state support)
- **Depth Control**: 0–3 levels of crawl depth
- **Export CSV (All Links)**: Always exports all discovered links; format is view-aware:
  - **Sitemap mode** (7 cols): `Depth`, `Path` (indented with `·` per level), `Parent URL`, `URL`, `Link Text`, `Category`, `Internal/External` — sorted by depth
  - **List mode** (4 cols): `Category`, `Link Text`, `URL`, `Internal/External`
- **Delete Selection**: Removes checkbox-selected URLs from the result list (replaces "Clear Selection")
- **Selection Counter**: Shows `Selected / Total` link count
- **`📦 Batch Crawl (N)` button**: Sends selected links directly to Batch Crawl tab

### Batch Crawl Features

- **Two Input Methods**:
  - Link Collector → select links → `📦 Batch Crawl (N)` button (auto-navigates)
  - CSV upload (drag & drop) — supports both List and Sitemap export formats
- **Link Preview Table**: Shows link text, URL, status icon, and output filename before/during crawl
- **Per-link Status**: `⏳ Pending` → `🔄 Crawling` → `✅ Done` / `❌ Failed`
- **Progress Bar**: Animated progress bar with percentage
- **Live Log Panel**: SSE-streamed events in real time
- **Result Banner**: Shows exact output folder path on completion
- **Custom Folder Name**: Optional — defaults to `vcrawl_batch_YYYYMMDD_HHMMSS/`
- **File Naming**: `0001_Link_Text.md` (4-digit zero-padded index + sanitized link text)

## 🐳 Docker Deployment

Run the entire stack with Docker Compose:

```bash
docker-compose up -d
```

This will start:
- Backend API on `http://localhost:8000`
- Frontend on `http://localhost:80`

## 🛠️ Technologies Used

### Backend
- **FastAPI**: Modern, fast web framework
- **Crawl4AI v0.8.0**: Advanced web crawling library
- **BeautifulSoup4**: HTML parsing and analysis
- **html2text**: HTML to Markdown conversion
- **Playwright**: Browser automation

### Frontend
- **React 19**: UI framework
- **Vite**: Build tool and dev server
- **Vanilla CSS**: Custom styling with modern design

## 📝 Configuration

### Backend Configuration

Edit `backend/main.py` to customize:
- Browser timeout: `page_timeout` (default: 60000ms)
- Wait condition: `wait_until` (default: "networkidle")
- Delay before capture: `delay_before_return_html` (default: 2.0s)

### Frontend Configuration

Edit `frontend/vite.config.js` to customize:
- API proxy settings
- Build options
- Dev server port

## 🔍 How It Works

1. **URL Input**: User enters a URL (protocol optional)
2. **Crawling**: Backend uses Crawl4AI with Playwright to load the page
3. **Content Extraction**: 
   - Waits for network to be idle
   - Extracts full HTML and converts to Markdown
   - Identifies main content using heuristics
   - Analyzes page structure (header, nav, footer, ads)
4. **Display**: Frontend shows results in multiple formats with tabbed interface

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 👥 Authors

- Veluga Team

## 🙏 Acknowledgments

- [Crawl4AI](https://github.com/unclecode/crawl4ai) for the powerful crawling engine
- [FastAPI](https://fastapi.tiangolo.com/) for the excellent web framework
- [React](https://react.dev/) for the UI library

## 📞 Support

For issues and questions, please open an issue on GitHub.

---

**Note**: This is an MVP (Minimum Viable Product) for testing web scraping capabilities. For production use, consider adding:
- Rate limiting
- Authentication
- Caching
- Error handling improvements
- Database integration
- API key management
