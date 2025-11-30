from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from crawl4ai import AsyncWebCrawler
import uvicorn
import asyncio
import sys
import html2text

# Fix for Windows asyncio loop policy
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

app = FastAPI(title="Crawl4AI Tester")

class CrawlRequest(BaseModel):
    url: str
    word_count_threshold: int = 10

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
        
        crawl_config = CrawlerRunConfig(
            wait_until="networkidle",  # Wait for network to be idle
            page_timeout=60000,  # 60 seconds timeout
            delay_before_return_html=2.0  # Wait 2 seconds before capturing
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

            return CrawlResponse(
                success=True,
                markdown=result.markdown or "",
                html=result.cleaned_html or result.html or "",
                content_only_markdown=content_only_markdown,
                content_only_html=content_only_html,
                structure=structure_data,
                metadata={
                    "url": result.url,
                }
            )
    except Exception as e:
        return CrawlResponse(
            success=False,
            error_message=str(e)
        )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
