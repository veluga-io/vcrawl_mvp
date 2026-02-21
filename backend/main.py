from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
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
    depth: int = 0
    max_urls: int = 500

class LinkItem(BaseModel):
    href: str
    text: str
    category: str  # 'Standard', 'File Download', 'Board/Forum'
    parent_url: str = ""
    depth: int = 0

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

async def _collect_links_generator(request: CollectLinksRequest):
    """Async generator that yields SSE-formatted JSON events during link collection."""
    import urllib.parse
    import json

    def sse(data: dict) -> str:
        return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

    try:
        url_to_crawl = request.url.strip()
        if not url_to_crawl:
            yield sse({"type": "error", "message": "URL cannot be empty"})
            return

        if not url_to_crawl.startswith(('http://', 'https://')):
            url_to_crawl = 'https://' + url_to_crawl

        parsed_seed = urllib.parse.urlparse(url_to_crawl)
        base_domain = parsed_seed.netloc

        target_depth = max(0, min(request.depth, 3))
        max_urls = max(1, min(request.max_urls, 2000))

        all_internal_items = {}
        all_external_items = {}

        yield sse({"type": "log", "message": f"🚀 Starting crawl: {url_to_crawl}"})
        yield sse({"type": "log", "message": f"📋 Depth: {target_depth}  |  Max URLs: {max_urls}"})

        async with AsyncWebCrawler(verbose=False) as crawler:
            visited_urls = set()
            current_level_urls = [url_to_crawl]

            for current_d in range(target_depth + 1):
                if not current_level_urls:
                    break

                yield sse({"type": "log", "message": f"🔍 Depth {current_d}: fetching {len(current_level_urls)} URL(s)…"})

                if len(current_level_urls) == 1:
                    results = [await crawler.arun(url=current_level_urls[0])]
                else:
                    results = await crawler.arun_many(urls=current_level_urls)

                visited_urls.update(current_level_urls)
                next_level_urls = set()
                success_count = 0
                fail_count = 0

                for res in results:
                    if not res.success:
                        fail_count += 1
                        yield sse({"type": "log", "message": f"  ⚠️  Failed: {getattr(res, 'url', '?')}"})
                        continue

                    success_count += 1
                    links_dict = res.links if hasattr(res, 'links') and res.links else {}
                    internal = links_dict.get('internal', [])
                    external = links_dict.get('external', [])

                    new_internal = 0
                    for link in internal:
                        href = link.get('href', '')
                        text = link.get('text', '').strip()
                        if not href:
                            continue
                        if href not in all_internal_items:
                            category = categorize_link(href, text)
                            all_internal_items[href] = LinkItem(href=href, text=text, category=category, parent_url=getattr(res, 'url', ''), depth=current_d)
                            new_internal += 1
                        if current_d < target_depth:
                            try:
                                parsed_href = urllib.parse.urlparse(href)
                                if parsed_href.netloc == base_domain or not parsed_href.netloc:
                                    if href not in visited_urls:
                                        next_level_urls.add(href)
                            except Exception:
                                pass

                    for link in external:
                        href = link.get('href', '')
                        text = link.get('text', '').strip()
                        if not href:
                            continue
                        if href not in all_external_items:
                            category = categorize_link(href, text)
                            all_external_items[href] = LinkItem(href=href, text=text, category=category, parent_url=getattr(res, 'url', ''), depth=current_d)

                    yield sse({"type": "log", "message": f"  ✅ {getattr(res, 'url', '?')} → +{new_internal} internal links"})

                yield sse({"type": "log", "message": f"📊 Depth {current_d} done — ✅ {success_count} ok, ⚠️ {fail_count} failed. Total internal: {len(all_internal_items)}, external: {len(all_external_items)}"})

                current_level_urls = list(next_level_urls)
                if len(visited_urls) + len(current_level_urls) > max_urls:
                    remaining_allowance = max_urls - len(visited_urls)
                    current_level_urls = current_level_urls[:max(0, remaining_allowance)]
                    yield sse({"type": "log", "message": f"⚡ Max URL limit ({max_urls}) reached. Truncating queue to {len(current_level_urls)}."})

        yield sse({"type": "log", "message": f"🏁 Crawl complete! Found {len(all_internal_items)} internal and {len(all_external_items)} external links."})
        yield sse({
            "type": "done",
            "internal_links": [item.model_dump() for item in all_internal_items.values()],
            "external_links": [item.model_dump() for item in all_external_items.values()],
        })

    except Exception as e:
        yield sse({"type": "error", "message": str(e)})


@app.post("/api/v1/collect-links")
async def collect_links(request: CollectLinksRequest):
    return StreamingResponse(
        _collect_links_generator(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

# ──────────────────────────────────────────────
# Batch Crawl – Crawl multiple URLs and save Full Markdown to Downloads
# ──────────────────────────────────────────────

import re
import pathlib
import datetime

class BatchCrawlLink(BaseModel):
    href: str
    text: str = ""

class BatchCrawlRequest(BaseModel):
    links: list[BatchCrawlLink]
    output_folder_name: str = ""

def _safe_filename(text: str, index: int, max_len: int = 80) -> str:
    """Build a safe 4-digit-padded filename from link text."""
    prefix = f"{index:04d}"
    if not text.strip():
        return f"{prefix}_page"
    # Replace problematic characters with underscore
    clean = re.sub(r'[\\/:*?"<>|]', '_', text.strip())
    # Collapse multiple spaces/underscores
    clean = re.sub(r'[\s_]+', '_', clean)
    # Trim to max_len
    clean = clean[:max_len]
    # Strip leading/trailing underscores
    clean = clean.strip('_')
    return f"{prefix}_{clean}" if clean else prefix

async def _batch_crawl_generator(request: BatchCrawlRequest):
    """SSE generator: crawls each link and saves Full Markdown to the Downloads folder."""
    import json

    def sse(data: dict) -> str:
        return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

    try:
        from crawl4ai import BrowserConfig, CrawlerRunConfig

        if not request.links:
            yield sse({"type": "error", "message": "링크 목록이 비어 있습니다."})
            return

        # Determine output folder
        downloads_dir = pathlib.Path.home() / "Downloads"
        folder_name = request.output_folder_name.strip()
        if not folder_name:
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            folder_name = f"vcrawl_batch_{timestamp}"
        output_dir = downloads_dir / folder_name
        output_dir.mkdir(parents=True, exist_ok=True)

        total = len(request.links)
        yield sse({"type": "log", "message": f"📁 출력 폴더: {output_dir}"})
        yield sse({"type": "log", "message": f"📋 총 {total}개 링크 처리 시작…"})

        browser_config = BrowserConfig(headless=True, verbose=False)
        crawl_config = CrawlerRunConfig(
            wait_until="domcontentloaded",
            page_timeout=90000,
            delay_before_return_html=2.0,
        )

        success_count = 0
        fail_count = 0

        async with AsyncWebCrawler(config=browser_config, verbose=False) as crawler:
            for idx, link in enumerate(request.links, start=1):
                url = link.href.strip()
                link_text = link.text.strip() or url
                if not url.startswith(("http://", "https://")):
                    url = "https://" + url

                filename = _safe_filename(link_text, idx) + ".md"
                filepath = output_dir / filename

                yield sse({
                    "type": "progress",
                    "current": idx,
                    "total": total,
                    "url": url,
                    "filename": filename,
                    "status": "crawling",
                })

                try:
                    result = await crawler.arun(url=url, config=crawl_config)

                    if not result.success:
                        fail_count += 1
                        yield sse({
                            "type": "progress",
                            "current": idx,
                            "total": total,
                            "url": url,
                            "filename": filename,
                            "status": "failed",
                            "error": result.error_message or "Unknown error",
                        })
                        continue

                    # Build Full Markdown with citation
                    source_url = result.url or url
                    citation = f"\n\n---\n**출처(Citations):** [{source_url}]({source_url})"
                    markdown_content = (result.markdown or "") + citation

                    # Write to file (UTF-8)
                    filepath.write_text(markdown_content, encoding="utf-8")
                    success_count += 1

                    yield sse({
                        "type": "progress",
                        "current": idx,
                        "total": total,
                        "url": url,
                        "filename": filename,
                        "status": "done",
                    })

                except Exception as e:
                    fail_count += 1
                    yield sse({
                        "type": "progress",
                        "current": idx,
                        "total": total,
                        "url": url,
                        "filename": filename,
                        "status": "failed",
                        "error": str(e),
                    })

        yield sse({
            "type": "complete",
            "folder_path": str(output_dir),
            "total_success": success_count,
            "total_failed": fail_count,
        })

    except Exception as e:
        import json
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"


# ──────────────────────────────────────────────
# LLM Batch — OpenAI Batch API
# ──────────────────────────────────────────────
import json
import uuid

class LLMBatchConvertRequest(BaseModel):
    folder_path: str
    instruction: str
    model: str = "gpt-5-mini"

class LLMBatchSubmitRequest(BaseModel):
    jsonl_folder_path: str

class LLMBatchStatusRequest(BaseModel):
    batch_ids: list[str]

class LLMBatchResultsRequest(BaseModel):
    batch_ids: list[str]
    output_folder_path: str = ""

@app.post("/api/v1/llm-batch/convert")
async def batch_convert(request: LLMBatchConvertRequest):
    try:
        folder_path = pathlib.Path(request.folder_path.strip('"\' '))
        if not folder_path.is_dir():
            raise Exception(f"Invalid directory path: {folder_path}")

        md_files = list(folder_path.glob("*.md"))
        if not md_files:
            raise Exception("No .md files found in the directory.")

        output_dir = folder_path.parent / f"{folder_path.name}_jsonl"
        output_dir.mkdir(parents=True, exist_ok=True)

        # OpenAI Limits
        MAX_REQUESTS_PER_FILE = 50000
        # Target 500MB max per file to be safely under 512MB
        MAX_BYTES_PER_FILE = 500 * 1024 * 1024 

        current_file_index = 1
        current_request_count = 0
        current_file_bytes = 0
        
        out_file = output_dir / f"batch_{current_file_index:03d}.jsonl"
        f_out = open(out_file, "w", encoding="utf-8")

        files_info = []
        for file_path in md_files:
            content = file_path.read_text(encoding="utf-8")
            custom_id = file_path.stem

            if "gpt-5" in request.model:
                messages = [{"role": "user", "content": f"System Instruction:\n{request.instruction}\n\nUser Content:\n{content}"}]
                body = {
                    "model": request.model,
                    "messages": messages,
                    "reasoning_effort": "low"
                }
            else:
                messages = [
                    {"role": "system", "content": request.instruction},
                    {"role": "user", "content": content}
                ]
                body = {
                    "model": request.model,
                    "messages": messages
                }

            jsonl_entry = {
                "custom_id": custom_id,
                "method": "POST",
                "url": "/v1/chat/completions",
                "body": body
            }

            line = json.dumps(jsonl_entry, ensure_ascii=False) + "\n"
            line_bytes = len(line.encode("utf-8"))

            # Check if adding this prevents exceeding limits
            if current_request_count >= MAX_REQUESTS_PER_FILE or (current_file_bytes + line_bytes) > MAX_BYTES_PER_FILE:
                f_out.close()
                current_file_index += 1
                out_file = output_dir / f"batch_{current_file_index:03d}.jsonl"
                f_out = open(out_file, "w", encoding="utf-8")
                
                current_request_count = 0
                current_file_bytes = 0

            f_out.write(line)
            current_request_count += 1
            current_file_bytes += line_bytes
            files_info.append({"custom_id": custom_id, "batch_file": out_file.name})

        f_out.close()

        return {
            "success": True, 
            "output_folder": str(output_dir), 
            "file_count": len(files_info),
            "batch_files_created": current_file_index 
        }
    except Exception as e:
        return {"success": False, "error_message": str(e)}

@app.post("/api/v1/llm-batch/submit")
async def batch_submit(request: LLMBatchSubmitRequest):
    try:
        import openai
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise Exception("OPENAI_API_KEY is not set.")
        client = openai.OpenAI(api_key=api_key)

        folder_path = pathlib.Path(request.jsonl_folder_path.strip('"\' '))
        if not folder_path.is_dir():
            raise Exception(f"Invalid directory path: {folder_path}")

        jsonl_files = list(folder_path.glob("*.jsonl"))
        if not jsonl_files:
            raise Exception("No .jsonl files found in the directory.")

        batches = []
        for file_path in jsonl_files:
            with open(file_path, "rb") as f:
                file_obj = client.files.create(file=f, purpose="batch")
            
            batch_job = client.batches.create(
                input_file_id=file_obj.id,
                endpoint="/v1/chat/completions",
                completion_window="24h"
            )
            batches.append({
                "batch_id": batch_job.id,
                "input_file_id": file_obj.id,
                "filename": file_path.name,
                "status": batch_job.status
            })

        return {"success": True, "batches": batches}
    except Exception as e:
        return {"success": False, "error_message": str(e)}

@app.post("/api/v1/llm-batch/status")
async def batch_status(request: LLMBatchStatusRequest):
    try:
        import openai
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise Exception("OPENAI_API_KEY is not set.")
        client = openai.OpenAI(api_key=api_key)

        batches_info = []
        for batch_id in request.batch_ids:
            batch_job = client.batches.retrieve(batch_id)
            batches_info.append({
                "batch_id": batch_job.id,
                "status": batch_job.status,
                "completed": batch_job.request_counts.completed if batch_job.request_counts else 0,
                "failed": batch_job.request_counts.failed if batch_job.request_counts else 0,
                "total": batch_job.request_counts.total if batch_job.request_counts else 0,
                "output_file_id": batch_job.output_file_id,
                "error_file_id": batch_job.error_file_id
            })

        return {"success": True, "batches": batches_info}
    except Exception as e:
        return {"success": False, "error_message": str(e)}

class LLMBatchListRequest(BaseModel):
    limit: int = 30

@app.post("/api/v1/llm-batch/list")
async def batch_list(request: LLMBatchListRequest):
    try:
        import openai
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise Exception("OPENAI_API_KEY is not set.")
        client = openai.OpenAI(api_key=api_key)

        batch_jobs = client.batches.list(limit=request.limit)
        batches_info = []
        for batch_job in batch_jobs.data:
            batches_info.append({
                "batch_id": batch_job.id,
                "status": batch_job.status,
                "completed": batch_job.request_counts.completed if batch_job.request_counts else 0,
                "failed": batch_job.request_counts.failed if batch_job.request_counts else 0,
                "total": batch_job.request_counts.total if batch_job.request_counts else 0,
                "created_at": batch_job.created_at,
                "output_file_id": batch_job.output_file_id,
                "error_file_id": batch_job.error_file_id
            })

        return {"success": True, "batches": batches_info}
    except Exception as e:
        return {"success": False, "error_message": str(e)}

@app.post("/api/v1/llm-batch/results")
async def batch_results(request: LLMBatchResultsRequest):
    try:
        import openai
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise Exception("OPENAI_API_KEY is not set.")
        client = openai.OpenAI(api_key=api_key)

        if not request.batch_ids:
            raise Exception("No batch IDs provided.")

        total_files = 0
        rejected_count = 0
        
        # Determine output folder
        # For simplicity, we create a default folder in the user's Downloads or beside the script if path not provided.
        # But we'll try to put it beside the current working directory if output_folder_path is empty.
        if request.output_folder_path:
            output_dir = pathlib.Path(request.output_folder_path.strip('"\' '))
        else:
            output_dir = pathlib.Path.cwd() / "batch_results"
        
        output_dir.mkdir(parents=True, exist_ok=True)

        for batch_id in request.batch_ids:
            batch_job = client.batches.retrieve(batch_id)
            if batch_job.status == "completed" and batch_job.output_file_id:
                # Download results
                response = client.files.content(batch_job.output_file_id)
                content = response.text
                
                for line in content.strip().split("\n"):
                    if not line.strip(): continue
                    result_data = json.loads(line)
                    
                    custom_id = result_data.get("custom_id", f"unknown_{uuid.uuid4().hex[:8]}")
                    
                    try:
                        response_body = result_data["response"]["body"]
                        llm_text = response_body["choices"][0]["message"]["content"]
                    except (KeyError, IndexError, TypeError):
                        llm_text = "ERROR: Failed to parse LLM response from batch result."
                    
                    # Filename logic
                    # custom_id is the original file stem (e.g. "0001_pagename")
                    # Sanitize any Windows-illegal characters just in case
                    MAX_BASE_LEN = 180  # leave room for suffix + .md
                    REJECTED_SUFFIX = " [REJECTED]"
                    base_filename = re.sub(r'[<>:"\\|?*]', '_', custom_id)

                    is_rejected = "[STATUS: REJECTED]" in llm_text

                    if is_rejected:
                        rejected_count += 1
                        # Trim base so total stays within OS limit
                        trimmed = base_filename[:MAX_BASE_LEN]
                        out_file = output_dir / f"{trimmed}{REJECTED_SUFFIX}.md"
                    else:
                        out_file = output_dir / f"{base_filename[:MAX_BASE_LEN + len(REJECTED_SUFFIX)]}.md"
                    
                    out_file.write_text(llm_text, encoding="utf-8")
                    total_files += 1

        return {
            "success": True, 
            "output_folder": str(output_dir), 
            "total_files": total_files, 
            "rejected_count": rejected_count
        }
    except Exception as e:
        return {"success": False, "error_message": str(e)}

@app.post("/api/v1/batch-crawl")
async def batch_crawl(request: BatchCrawlRequest):
    return StreamingResponse(
        _batch_crawl_generator(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
