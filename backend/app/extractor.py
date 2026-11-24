"""Download a web page and extract the article text safely."""
import ipaddress
import re
import socket
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; FakeNewsAnalyzer/1.0; educational project)"}
MAX_BYTES = 2_000_000
MIN_CHARS = 200
MAX_REDIRECTS = 5


class ExtractionError(Exception):
    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _check_url(url: str):
    """Reject non-http(s) URLs and addresses on private/internal networks (SSRF protection)."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ExtractionError("Please enter a valid HTTP or HTTPS URL (e.g. https://example.com/article).", 400)
    
    hostname = parsed.hostname.lower()
    if hostname in ("localhost", "127.0.0.1", "0.0.0.0", "::1", "local"):
        raise ExtractionError("Access to local or internal network addresses is restricted.", 400)

    try:
        infos = socket.getaddrinfo(hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror:
        raise ExtractionError("Could not resolve that website domain. Please check the URL.", 400)

    for info in infos:
        try:
            ip = ipaddress.ip_address(info[4][0])
        except ValueError:
            raise ExtractionError("Invalid host address format.", 400)
        if not ip.is_global:
            raise ExtractionError("Access to private, loopback, or internal addresses is blocked for security.", 400)


def _fetch(url: str):
    current = url
    for _ in range(MAX_REDIRECTS + 1):
        _check_url(current)
        try:
            r = requests.get(current, headers=HEADERS, timeout=(5, 10), stream=True, allow_redirects=False)
        except requests.exceptions.Timeout:
            raise ExtractionError("The website took too long to respond.")
        except requests.exceptions.RequestException:
            raise ExtractionError("Could not connect to that website.")
        if r.status_code in (301, 302, 303, 307, 308):
            location = r.headers.get("Location")
            r.close()
            if not location:
                raise ExtractionError("The website sent an invalid redirect.")
            current = urljoin(current, location)
            continue
        break
    else:
        raise ExtractionError("The website redirected too many times.")

    if r.status_code >= 400:
        r.close()
        raise ExtractionError(f"The website returned an error (HTTP {r.status_code}). It may block automated access.")
    if "html" not in r.headers.get("Content-Type", "").lower():
        r.close()
        raise ExtractionError("That link is not a web page (unsupported content type).")

    data = b""
    for chunk in r.iter_content(65536):
        data += chunk
        if len(data) > MAX_BYTES:
            break
    r.close()
    return current, data


def extract_article(url: str) -> dict:
    url = (url or "").strip()
    if not url:
        raise ExtractionError("Please enter a URL.", 400)
    if not re.match(r"^[a-z][a-z0-9+.-]*://", url, re.I):
        url = "https://" + url

    final_url, html = _fetch(url)
    soup = BeautifulSoup(html, "html.parser")

    # 1. Source / Domain
    domain = urlparse(final_url).netloc.lower()
    if domain.startswith("www."):
        domain = domain[4:]

    # 2. Title
    title = None
    og_title = soup.find("meta", property="og:title")
    tw_title = soup.find("meta", attrs={"name": "twitter:title"})
    if og_title and og_title.get("content"):
        title = og_title["content"].strip()
    elif tw_title and tw_title.get("content"):
        title = tw_title["content"].strip()
    elif soup.title and soup.title.string:
        title = soup.title.string.strip()
    elif soup.h1:
        title = soup.h1.get_text(" ", strip=True)

    # 3. Description
    description = None
    desc_meta = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", property="og:description")
    if desc_meta and desc_meta.get("content"):
        description = desc_meta["content"].strip()

    # 4. Author
    author = None
    author_meta = (
        soup.find("meta", attrs={"name": "author"})
        or soup.find("meta", property="article:author")
        or soup.find("meta", attrs={"name": "twitter:creator"})
    )
    if author_meta and author_meta.get("content"):
        author = author_meta["content"].strip()
    else:
        author_el = soup.find(attrs={"rel": "author"}) or soup.find(class_=re.compile(r"\bbyline\b|\bauthor-name\b", re.I))
        if author_el:
            author = author_el.get_text(" ", strip=True)

    # 5. Publication Date
    pub_date = None
    date_meta = (
        soup.find("meta", property="article:published_time")
        or soup.find("meta", attrs={"name": "publication_date"})
        or soup.find("meta", attrs={"name": "date"})
        or soup.find("meta", attrs={"name": "pubdate"})
    )
    if date_meta and date_meta.get("content"):
        pub_date = date_meta["content"].strip()
    else:
        time_el = soup.find("time")
        if time_el and (time_el.get("datetime") or time_el.get_text()):
            pub_date = (time_el.get("datetime") or time_el.get_text(" ", strip=True)).strip()

    # 6. Canonical URL
    canonical_url = None
    canon_link = soup.find("link", rel="canonical")
    if canon_link and canon_link.get("href"):
        canonical_url = canon_link["href"].strip()

    # 7. Safe Image URL (OG / Twitter image)
    image_url = None
    og_img = soup.find("meta", property="og:image") or soup.find("meta", attrs={"name": "twitter:image"})
    if og_img and og_img.get("content"):
        raw_img = og_img["content"].strip()
        if re.match(r"^https?://", raw_img, re.I):
            image_url = raw_img
        elif raw_img.startswith("/"):
            image_url = urljoin(final_url, raw_img)

    # 8. Strip non-content and clutter elements
    for tag in soup(["script", "style", "noscript", "nav", "footer", "header", "aside", "form", "iframe", "svg", "button", "input", "select", "dialog"]):
        tag.decompose()

    clutter_pattern = re.compile(
        r"(cookie|consent|banner|advert|ad-|ads-|sponsor|social-share|share-bar|newsletter|modal|popup|sidebar|disclaimer|promoted|related-posts|comments|recommendations|outbrain|taboola|subscribe)",
        re.I,
    )
    for el in soup.find_all(attrs={"class": clutter_pattern}):
        el.decompose()
    for el in soup.find_all(attrs={"id": clutter_pattern}):
        el.decompose()

    def paragraphs(node):
        paras = [p.get_text(" ", strip=True) for p in node.find_all("p")]
        return "\n\n".join(p for p in paras if len(p) >= 35)

    # Extract primary article body
    article_node = soup.find("article") or soup.find("main") or soup
    text = paragraphs(article_node)
    if len(text) < MIN_CHARS:
        text = paragraphs(soup)  # fall back to the whole page

    # Clean whitespace and control characters
    text = re.sub(r"[\r\t\f\v]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()

    if len(text) < MIN_CHARS:
        raise ExtractionError(
            "Unable to extract readable article content from this URL. It may be behind a paywall, require JavaScript rendering, "
            "or not contain readable article paragraphs. Try pasting the article text directly instead."
        )

    word_count = len(text.split())

    return {
        "url": final_url,
        "title": title or "Extracted Web Article",
        "text": text,
        "domain": domain,
        "author": author,
        "publication_date": pub_date,
        "canonical_url": canonical_url,
        "description": description,
        "image_url": image_url,
        "word_count": word_count,
    }
