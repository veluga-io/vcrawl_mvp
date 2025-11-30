# Veluga Website Crawl Tester

A powerful web scraping testing tool built with FastAPI and React, designed to analyze and extract content from websites using Crawl4AI.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-blue.svg)
![React](https://img.shields.io/badge/react-19.2.0-blue.svg)

## 🌟 Features

- **Smart Content Extraction**: Automatically identifies and extracts main content from web pages
- **Multiple Output Formats**:
  - Content-only Markdown (clean, LLM-friendly)
  - Content-only HTML (main content without headers/footers/ads)
  - Full page Markdown
  - Full page HTML
- **Page Structure Analysis**: Identifies headers, navigation, main content, footers, and ads
- **Real-time Crawling**: Live feedback with loading states
- **Network Idle Detection**: Waits for dynamic content to fully load
- **Auto-protocol Addition**: Automatically adds `https://` if missing from URLs
- **Premium Dark UI**: Modern, responsive interface with smooth animations

## 📋 Prerequisites

- Python 3.11 or higher
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
│   ├── main.py              # FastAPI application
│   ├── requirements.txt     # Python dependencies
│   └── Dockerfile          # Backend Docker configuration
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── SearchBar.jsx
│   │   │   ├── ResultViewer.jsx
│   │   │   └── LoadingSpinner.jsx
│   │   ├── App.jsx         # Main application
│   │   └── index.css       # Styling
│   ├── package.json        # npm dependencies
│   └── Dockerfile          # Frontend Docker configuration
├── docker-compose.yml      # Docker Compose configuration
└── README.md              # This file
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

## 🎨 UI Features

### Tabs

1. **Content (MD)** - Main content in Markdown format (default)
2. **Content (HTML)** - Main content in HTML format
3. **Full Markdown** - Complete page in Markdown
4. **Full HTML** - Complete page in HTML
5. **Structure** - Page structure analysis

### Actions

- **Copy Content**: Copy the current tab's content to clipboard
- **URL Display**: Shows the crawled URL

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
- **Crawl4AI**: Advanced web crawling library
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
