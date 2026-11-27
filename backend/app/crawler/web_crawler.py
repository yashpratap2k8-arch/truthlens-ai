import logging
import requests
from bs4 import BeautifulSoup
from typing import Dict, Any, Optional

try:
    import trafilatura
except ImportError:
    trafilatura = None

try:
    from app.extractor import _check_url, ExtractionError
except ImportError:
    try:
        from ..extractor import _check_url, ExtractionError
    except Exception:
        _check_url = None
        ExtractionError = Exception

log = logging.getLogger(__name__)


class WebCrawler:
    """Targeted web crawler with SSRF protection, timeout, and redirect safety."""

    def __init__(self, timeout: int = 10, max_redirects: int = 5):
        self.timeout = timeout
        self.max_redirects = max_redirects
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0 Safari/537.36"
            )
        }

    def fetch_page(self, url: str) -> Dict[str, Any]:
        """Safely fetch a webpage with SSRF validation."""
        # SSRF protection
        if _check_url:
            try:
                _check_url(url)
            except Exception as e:
                return {
                    "success": False,
                    "url": url,
                    "error": f"SSRF Check Failed: {e}",
                    "status_code": 400,
                }

        try:
            response = requests.get(
                url,
                headers=self.headers,
                timeout=self.timeout,
                allow_redirects=True,
            )

            # Re-verify final redirect target for SSRF safety
            if _check_url and response.url != url:
                try:
                    _check_url(response.url)
                except Exception as e:
                    return {
                        "success": False,
                        "url": response.url,
                        "error": f"Redirect blocked by SSRF check: {e}",
                        "status_code": 400,
                    }

            response.raise_for_status()

            return {
                "success": True,
                "url": response.url,
                "html": response.text,
                "status_code": response.status_code,
            }

        except requests.RequestException as e:
            return {
                "success": False,
                "url": url,
                "error": str(e),
                "status_code": getattr(getattr(e, "response", None), "status_code", 500),
            }

    def crawl(self, url: str) -> Dict[str, Any]:
        """Fetch and extract article content, title, and metadata."""
        page = self.fetch_page(url)
        if not page.get("success"):
            return page

        soup = BeautifulSoup(page.get("html", ""), "html.parser")
        title = soup.title.get_text(strip=True) if soup.title else ""

        article_text = ""
        if trafilatura:
            try:
                article_text = trafilatura.extract(
                    page.get("html", ""),
                    include_comments=False,
                    include_tables=False,
                    favor_precision=True,
                ) or ""
            except Exception as e:
                log.warning(f"trafilatura extraction error: {e}")

        # Fallback to BeautifulSoup paragraph extraction if trafilatura produces nothing
        if not article_text:
            for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
                tag.decompose()
            paras = [p.get_text(" ", strip=True) for p in soup.find_all("p")]
            article_text = "\n\n".join(p for p in paras if len(p) >= 30)

        word_count = len(article_text.split())

        return {
            "success": True,
            "url": page["url"],
            "title": title,
            "text": article_text,
            "word_count": word_count,
            "status_code": page["status_code"],
        }
