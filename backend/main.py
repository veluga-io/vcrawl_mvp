from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from crawl4ai import AsyncWebCrawler
import uvicorn
import asyncio
import sys
import html2text
import os
from crawl4ai import LLMConfig
from crawl4ai.extraction_strategy import LLMExtractionStrategy
from pydantic import BaseModel, Field

from dotenv import load_dotenv

load_dotenv()

# --- Patch litellm for GPT-5 model family API changes ---
import litellm
import copy

_original_completion = litellm.completion

def _patched_completion(*args, **kwargs):
    model = kwargs.get("model") or (args[0] if args else "")
    
    # Check if this is a gpt-5 family model
    if "gpt-5" in model:
        # 1. API Format Change: the new models do NOT support 'system' roles directly
        if "messages" in kwargs:
            messages = copy.deepcopy(kwargs["messages"])
            new_msgs = []
            sys_content = ""
            for m in messages:
                if m.get("role") == "system":
                    sys_content += m.get("content", "") + "\n\n"
                else:
                    new_msgs.append(m)
                    
            if sys_content and new_msgs and new_msgs[0]["role"] == "user":
                new_msgs[0]["content"] = f"System Instruction:\n{sys_content}\nUser Content:\n{new_msgs[0].get('content', '')}"
            elif sys_content:
                new_msgs.insert(0, {"role": "user", "content": sys_content})
                
            kwargs["messages"] = new_msgs
            
        # 2. API Format Change: 'max_tokens' has been replaced with 'max_completion_tokens'
        if "max_tokens" in kwargs:
            kwargs["max_completion_tokens"] = kwargs.pop("max_tokens")
            
        # 3. Add reasoning effort for gpt-5 family
        kwargs["reasoning_effort"] = "low"
            
    return _original_completion(*args, **kwargs)

litellm.completion = _patched_completion
# --------------------------------------------------------

# Fix for Windows asyncio loop policy

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

app = FastAPI(title="Crawl4AI Tester")

class CrawlRequest(BaseModel):
    url: str
    word_count_threshold: int = 10
    # Full litellm model string, e.g. 'gemini/gemini-3-pro-preview', 'openai/gpt-5-mini', or 'none'
    llm_model: str = "none"
    # Custom LLM instruction
    instruction: str = "Extract the main content, key points, and purpose of this page. Structure the output clearly in markdown."

from bs4 import BeautifulSoup

class PageStructure(BaseModel):
    header: str = "Not found"
    navigation: str = "Not found"
    main_content: str = "Not found"
    footer: str = "Not found"
    ads: list[str] = []

class CrawlResponse(BaseModel):
    success: bool
    markdown: str = ""
    html: str = ""
    content_only_markdown: str = ""  # Main content only in markdown
    content_only_html: str = ""      # Main content only in HTML
    llm_extraction: str = ""         # Content extracted by LLM
    structure: PageStructure = PageStructure()
    metadata: dict = {}
    error_message: str = ""

def find_element_by_heuristics(soup, tags, keywords):
    # 1. Try specific tags first
    for tag in tags:
        element = soup.find(tag)
        if element: return element
    
    # 2. Search by ID/Class with keywords
    candidates = []
    for keyword in keywords:
        # ID search
        elements = soup.find_all(attrs={"id": lambda x: x and keyword in x.lower()})
        candidates.extend(elements)
        # Class search
        elements = soup.find_all(attrs={"class": lambda x: x and any(keyword in c.lower() for c in x)})
        candidates.extend(elements)
    
    if not candidates:
        return None

    # 3. Score candidates based on text length and density
    best_candidate = None
    max_score = 0
    
    for element in candidates:
        text_len = len(element.get_text(strip=True))
        if text_len == 0: continue
        
        # Simple score: text length
        score = text_len
        
        # Boost if it's a div or section
        if element.name in ['div', 'section', 'article']:
            score *= 1.2
            
        if score > max_score:
            max_score = score
            best_candidate = element
            
    return best_candidate

def analyze_structure(html: str):
    """Analyze page structure and return both structure data and main content element"""
    soup = BeautifulSoup(html, 'html.parser')
    structure = PageStructure()
    main_element = None  # Store the full main element

    # 1. Header
    # Keywords: header, top, gnb (Global Navigation Bar), head
    header = find_element_by_heuristics(soup, ['header'], ['header', 'top', 'gnb', 'head'])
    if header:
        structure.header = str(header)[:1000] + "..." if len(str(header)) > 1000 else str(header)
    
    # 2. Navigation
    # Keywords: nav, menu, lnb (Local Navigation Bar)
    nav = find_element_by_heuristics(soup, ['nav'], ['nav', 'menu', 'lnb'])
    if nav:
        structure.navigation = str(nav)[:1000] + "..." if len(str(nav)) > 1000 else str(nav)

    # 3. Main Content
    # Keywords: main, content, body, article, center, container, wrapper
    main = find_element_by_heuristics(soup, ['main', 'article'], ['content', 'main', 'body', 'center', 'container', 'wrapper'])
    
    # Fallback: If no main found by keywords, find the div with the most text
    if not main:
        divs = soup.find_all('div')
        max_text_len = 0
        for div in divs:
            # Skip if it's likely a wrapper for the whole page (too large relative to body)
            # This is a simple heuristic; can be improved
            text_len = len(div.get_text(strip=True))
            if text_len > max_text_len:
                max_text_len = text_len
                main = div

    if main:
        main_element = main  # Store the full element
        structure.main_content = str(main)[:2000] + "..." if len(str(main)) > 2000 else str(main)

    # 4. Footer
    # Keywords: footer, bottom, info, copyright
    footer = find_element_by_heuristics(soup, ['footer'], ['footer', 'bottom', 'info', 'copyright'])
    if footer:
        structure.footer = str(footer)[:1000] + "..." if len(str(footer)) > 1000 else str(footer)

    # 5. Ads (Heuristic)
    ad_selectors = [
        'iframe[src*="ads"]', 
        'div[id*="ad-"]', 'div[class*="ad-"]',
        'div[id*="banner"]', 'div[class*="banner"]',
        'ins.adsbygoogle',
        '[class*="promotion"]', '[id*="promotion"]'
    ]
    found_ads = []
    for selector in ad_selectors:
        ads = soup.select(selector)
        for ad in ads:
            found_ads.append(str(ad)[:200] + "...")
            if len(found_ads) >= 5: break 
        if len(found_ads) >= 5: break
    
    structure.ads = found_ads
    return structure, main_element

@app.post("/api/v1/crawl", response_model=CrawlResponse)
async def crawl(request: CrawlRequest):
    try:
        url = request.url
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        
        from crawl4ai import BrowserConfig, CrawlerRunConfig
        
        browser_config = BrowserConfig(
            headless=True,
            verbose=True
        )
        
        # Try with networkidle first, but have a fallback
        crawl_config = CrawlerRunConfig(
            wait_until="domcontentloaded",  # More reliable than networkidle
            page_timeout=90000,             # 90 seconds timeout (increased for slow pages)
            delay_before_return_html=2.0    # Wait 2 seconds before capturing
        )
        
        async with AsyncWebCrawler(config=browser_config, verbose=True) as crawler:
            result = await crawler.arun(
                url=url, 
                config=crawl_config
            )
            
            if not result.success:
                 return CrawlResponse(
                    success=False,
                    error_message=result.error_message or "Unknown error occurred"
                )
            
            # Analyze structure and get main content element
            structure_data, main_element = analyze_structure(result.html)
            
            # Extract content-only versions
            content_only_html = ""
            content_only_markdown = ""
            
            if main_element:
                content_only_html = str(main_element)
                # Convert HTML to markdown
                h = html2text.HTML2Text()
                h.ignore_links = False
                h.ignore_images = False
                content_only_markdown = h.handle(content_only_html)
            
            # Debug logging
            print(f"[DEBUG] Markdown length: {len(result.markdown) if result.markdown else 0}")
            print(f"[DEBUG] HTML length: {len(result.html) if result.html else 0}")
            print(f"[DEBUG] Cleaned HTML length: {len(result.cleaned_html) if result.cleaned_html else 0}")
            print(f"[DEBUG] Content-only HTML length: {len(content_only_html)}")
            print(f"[DEBUG] Content-only Markdown length: {len(content_only_markdown)}")
            
            source_url = result.url or request.url
            md_citation = f"\n\n---\n**출처(Citations):** [{source_url}]({source_url})"
            html_citation = f"<br><hr><p><strong>출처(Citations):</strong> <a href='{source_url}'>{source_url}</a></p>"

            final_markdown = (result.markdown or "") + md_citation
            final_html = (result.cleaned_html or result.html or "") + html_citation
            final_content_only_markdown = content_only_markdown + md_citation if content_only_markdown else ""
            final_content_only_html = content_only_html + html_citation if content_only_html else ""
            
            return CrawlResponse(
                success=True,
                markdown=final_markdown,
                html=final_html,
                content_only_markdown=final_content_only_markdown,
                content_only_html=final_content_only_html,
                llm_extraction="",
                structure=structure_data,
                metadata={
                    "url": result.url,
                    "llm_model": request.llm_model
                }
            )
    except Exception as e:
        return CrawlResponse(
            success=False,
            error_message=str(e)
        )


# ──────────────────────────────────────────────
# LLM Analyzer – calls litellm directly for clean markdown output
# ──────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    content: str
    llm_model: str
    instruction: str = "Analyze the provided content and return a well-structured markdown report."


class AnalyzeResponse(BaseModel):
    success: bool
    result: str = ""
    error_message: str = ""


@app.post("/api/v1/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    try:
        if not request.llm_model or request.llm_model == "none":
            raise Exception("No LLM model selected. Please choose a model from the dropdown.")

        if not request.content.strip():
            raise Exception("Content is empty. Please provide text to analyze.")

        import litellm

        model_str = request.llm_model
        provider = model_str.split("/")[0] if "/" in model_str else model_str

        if provider == "gemini":
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                raise Exception("GEMINI_API_KEY is not set in the environment.")
        elif provider == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise Exception("OPENAI_API_KEY is not set in the environment.")
        else:
            raise Exception(f"Unsupported LLM provider: '{provider}'")

        response = litellm.completion(
            model=model_str,
            messages=[
                {"role": "system", "content": request.instruction},
                {"role": "user",   "content": request.content},
            ],
            api_key=api_key,
        )

        result_text = response.choices[0].message.content or ""
        return AnalyzeResponse(success=True, result=result_text)

    except Exception as e:
        return AnalyzeResponse(success=False, error_message=str(e))

# ──────────────────────────────────────────────
# Link Collector – Extract and categorize links
# ──────────────────────────────────────────────

class CollectLinksRequest(BaseModel):
    url: str

class LinkItem(BaseModel):
    href: str
    text: str
    category: str  # 'Standard', 'File Download', 'Board/Forum'

class CollectLinksResponse(BaseModel):
    success: bool
    internal_links: list[LinkItem] = []
    external_links: list[LinkItem] = []
    error_message: str = ""

def categorize_link(url: str, text: str) -> str:
    url_lower = url.lower()
    text_lower = text.lower()
    
    # 1. Check for files
    file_extensions = [
        '.pdf', '.zip', '.rar', '.hwp', '.doc', '.docx', 
        '.xls', '.xlsx', '.ppt', '.pptx', '.csv', 
        '.png', '.jpg', '.jpeg', '.gif', '.mp3', '.mp4', '.avi'
    ]
    if any(url_lower.endswith(ext) or (ext + '?') in url_lower for ext in file_extensions):
        return 'File Download'
        
    # 2. Check for boards/forums
    board_keywords = ['board', 'forum', 'bbs', 'view', 'article', 'notice', 'list.do', 'view.do']
    if any(kw in url_lower for kw in board_keywords) or any(kw in text_lower for kw in ['게시판', '공지사항', '자료실', '목록']):
        return 'Board/Forum'
        
    return 'Standard'

@app.post("/api/v1/collect-links", response_model=CollectLinksResponse)
async def collect_links(request: CollectLinksRequest):
    try:
        url_to_crawl = request.url.strip()
        if not url_to_crawl:
            raise Exception("URL cannot be empty")

        if not url_to_crawl.startswith(('http://', 'https://')):
            url_to_crawl = 'https://' + url_to_crawl

        async with AsyncWebCrawler(verbose=True) as crawler:
            # We don't need markdown/HTML content as much, we just need links.
            # But crawl4ai extracts them by default.
            result = await crawler.arun(url=url_to_crawl)

            if not result.success:
                raise Exception(f"Crawl failed: {result.error_message}")

            # Extract links dictionary
            links_dict = result.links if hasattr(result, 'links') and result.links else {}
            
            internal = links_dict.get('internal', [])
            external = links_dict.get('external', [])

            internal_items = []
            for link in internal:
                href = link.get('href', '')
                text = link.get('text', '').strip()
                if not href: continue
                category = categorize_link(href, text)
                internal_items.append(LinkItem(href=href, text=text, category=category))

            external_items = []
            for link in external:
                href = link.get('href', '')
                text = link.get('text', '').strip()
                if not href: continue
                category = categorize_link(href, text)
                external_items.append(LinkItem(href=href, text=text, category=category))

            return CollectLinksResponse(
                success=True,
                internal_links=internal_items,
                external_links=external_items
            )
    except Exception as e:
        return CollectLinksResponse(
            success=False,
            error_message=str(e)
        )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
