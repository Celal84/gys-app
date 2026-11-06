#!/usr/bin/env python3
"""Read-only public UYAP snapshot check. Technical changes are review events, never law approvals."""
import argparse
import base64
import concurrent.futures
import datetime as dt
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]
ENDPOINT = "https://bedesten.adalet.gov.tr/mevzuat/getDocumentContent"
CUTOFF = "2027-01-01"
MAX_RESPONSE_BYTES = 16 * 1024 * 1024


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def sha(data):
    return hashlib.sha256(data).hexdigest()


class NoExternalRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urllib.parse.urlparse(newurl).hostname != "bedesten.adalet.gov.tr" or not newurl.startswith("https://"):
            raise ValueError("Public source redirected outside the allowed official host")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class VisibleHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = 0
        self.structural_tags = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.hidden += 1
        if tag in ("p", "table", "td", "div", "br"):
            self.structural_tags += 1
            self.parts.append(" ")

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self.hidden:
            self.hidden -= 1

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def normalized(text):
    # Identity comparison tolerates the official registry's ISKAN/MALI spelling
    # versus the document's İSKÂN/MALÎ. Original bytes/text are never rewritten.
    folded = unicodedata.normalize("NFKD", text.casefold())
    unaccented = "".join(char for char in folded if not unicodedata.combining(char))
    return re.sub(r"[^\w]+", " ", unaccented).strip()


def document_text(content, mime):
    if mime == "application/pdf":
        if not content.startswith(b"%PDF-"):
            raise ValueError("Declared PDF has no PDF signature")
        # Failure or missing pdftotext is a failed parse, never HTTP-success validation.
        result = subprocess.run(["pdftotext", "-enc", "UTF-8", "-", "-"], input=content, capture_output=True, timeout=10, check=True)
        return result.stdout.decode("utf-8", errors="strict")
    if mime != "text/html":
        raise ValueError("Unsupported official content MIME type")
    prefix = content[:2000].decode("ascii", errors="ignore")
    encoding = re.search(r"charset\s*=\s*['\"]?([\w-]+)", prefix, re.I)
    # UYAP sometimes retains an old Word charset declaration while serving UTF-8.
    # Prefer valid UTF-8 bytes; fall back to the declaration without lossy replacement.
    try:
        text = content.decode("utf-8-sig", errors="strict")
    except UnicodeDecodeError:
        text = content.decode(encoding.group(1) if encoding else "utf-8", errors="strict")
    parser = VisibleHTML()
    parser.feed(text)
    parser.close()
    if parser.structural_tags < 3:
        raise ValueError("HTML contains no document structure")
    return " ".join(parser.parts)


def parse_response(raw, expected_title):
    if not raw:
        raise ValueError("Empty HTTP response")
    payload = json.loads(raw.decode("utf-8-sig"))
    data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(data, dict) or not isinstance(data.get("content"), str) or isinstance(data.get("version"), bool) or not isinstance(data.get("version"), (int, str)):
        raise ValueError("Official content/version envelope missing; possible HTML shell or API error")
    if not re.fullmatch(r"[1-9]\d{0,14}", str(data["version"])):
        raise ValueError("Official content version is empty or invalid")
    encoded = re.sub(r"\s+", "", data["content"])
    if not encoded:
        raise ValueError("Empty official document content")
    decoded = base64.b64decode(encoded, validate=True)
    if not decoded or len(decoded) > MAX_RESPONSE_BYTES:
        raise ValueError("Decoded official document empty or exceeds the byte limit")
    mime = str(data.get("mimeType", "")).split(";", 1)[0].strip().lower()
    text = document_text(decoded, mime)
    visible = normalized(text)
    # Exact instrument title is checked as well as a real article-bearing body.
    # CBK records append a parenthetical number to the title; the title itself is stable.
    title = normalized(expected_title.split("(KARARNAME NUMARASI", 1)[0])
    if len(visible) < 500 or not re.search(r"\bmadde\s+\d+\b", visible) or not title or title not in visible[:20000]:
        raise ValueError("Official instrument title/article text not verified; an HTTP-200 shell is not a legal snapshot")
    return {"decoded": decoded, "mime": mime, "version": data["version"], "text": text}


def registry_sources(registry_path):
    registry = json.loads(Path(registry_path).read_text(encoding="utf-8"))
    if registry.get("schemaVersion") != 1 or registry.get("examCutoffDate") != CUTOFF:
        raise ValueError("Unsupported source registry")
    sources = []
    for entry in registry["entries"]:
        if entry["topicId"] == "O04":
            continue  # History is not silently treated as a legal instrument.
        if entry["topicId"] == "O02":
            existing = json.loads((Path(registry_path).parent / "public-legal-sources/657-provisions.json").read_text(encoding="utf-8"))["snapshot"]
            item = {"topicId": "O02", "sourceId": existing["sourceId"], "documentId": entry["officialDocumentId"],
                    "type": "KANUN", "title": "DEVLET MEMURLARI KANUNU", "sourceUrl": existing["documentURL"],
                    "baselineSnapshotId": existing["sourceSnapshotId"], "baselineRawResponseSHA256": existing["rawResponseSHA256"],
                    "baselineDecodedContentSHA256": existing["decodedHTMLSHA256"], "baselineOfficialContentVersion": existing["officialContentVersion"],
                    "originalPublicationDate": existing.get("originalPublicationDate")}
        else:
            identity, snapshot = entry["identity"], entry["snapshot"]
            if identity["matchStatus"] not in ("ExactNumberTypeTitle", "ExactTypeTitle") or identity["observedType"] not in ("KANUN", "CB_KARARNAME", "KKY"):
                raise ValueError("Unverified instrument identity")
            item = {"topicId": entry["topicId"], "sourceId": re.sub(r"-\d{8}-[a-f0-9]{12}$", "", snapshot["sourceSnapshotId"]),
                    "documentId": identity["officialDocumentId"], "type": identity["observedType"], "title": identity["observedOfficialTitle"],
                    "sourceUrl": identity["officialDocumentURL"], "baselineSnapshotId": snapshot["sourceSnapshotId"],
                    "baselineRawResponseSHA256": snapshot["rawResponseSHA256"], "baselineDecodedContentSHA256": snapshot["decodedHTMLSHA256"],
                    "baselineOfficialContentVersion": snapshot["officialContentVersion"], "originalPublicationDate": entry["legalDates"].get("originalPublicationDate")}
        if not re.fullmatch(r"\d{1,12}", item["documentId"]) or item["sourceUrl"] != f'https://mevzuat.adalet.gov.tr/mevzuat/{item["documentId"]}':
            raise ValueError("Source identity/URL mismatch")
        sources.append(item)
    if len(sources) != 23 or len({s["topicId"] for s in sources}) != 23:
        raise ValueError("The registry must contain exactly 23 legal instruments")
    return sources


def immutable_write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with path.open("xb") as stream:
            stream.write(data)
    except FileExistsError:
        if path.read_bytes() != data:
            raise ValueError("Immutable snapshot conflict")


def fetch_source(source, *, batch_id, timeout=20, max_bytes=8 * 1024 * 1024, snapshot_dir=None, opener=None):
    checked = now()
    observation = {"id": f'{batch_id}:{source["topicId"]}', "sourceId": source["sourceId"], "topicId": source["topicId"],
                   "officialDocumentId": source["documentId"], "officialType": source["type"], "sourceUrl": source["sourceUrl"],
                   "checkedAt": checked, "result": "Failed", "parseVerified": False, "httpStatus": None, "responseByteLength": 0,
                   "declaredMimeType": None, "rawResponseSHA256": None, "decodedContentSHA256": None, "officialContentVersion": None,
                   **{k: source[k] for k in ("baselineSnapshotId", "baselineRawResponseSHA256", "baselineDecodedContentSHA256", "baselineOfficialContentVersion")},
                   "change": "Failed", "changedArticleNumbers": None,
                   "legalDates": {"originalPublicationDate": source.get("originalPublicationDate"), "amendmentPublicationDate": None,
                                  "effectiveFrom": None, "effectiveUntil": None, "transitionalProvisions": None, "transitionReviewStatus": "Pending"},
                   "error": None}
    try:
        payload = json.dumps({"data": {"documentType": "MEVZUAT", "id": source["documentId"]}, "applicationName": "UyapMevzuat"}).encode()
        req = urllib.request.Request(ENDPOINT, data=payload, method="POST", headers={"Content-Type": "application/json; charset=utf-8", "AdaletApplicationName": "UyapMevzuat", "Accept": "application/json"})
        fetch = opener or urllib.request.build_opener(NoExternalRedirect()).open
        with fetch(req, timeout=timeout) as response:
            observation["httpStatus"] = response.status
            if response.status != 200:
                raise ValueError(f"Official source returned HTTP {response.status}")
            declared = response.headers.get("Content-Length")
            if declared and int(declared) > max_bytes:
                raise ValueError("Response Content-Length exceeds byte limit")
            raw = response.read(max_bytes + 1)
            observation["responseByteLength"] = len(raw)
            if len(raw) > max_bytes:
                raise ValueError("Response exceeds byte limit")
        observation["rawResponseSHA256"] = sha(raw) if raw else None
        parsed = parse_response(raw, source["title"])
        observation.update({"declaredMimeType": parsed["mime"], "decodedContentSHA256": sha(parsed["decoded"]), "officialContentVersion": parsed["version"]})
        if not source["baselineDecodedContentSHA256"]:
            change = "FirstObservation"
        elif observation["decodedContentSHA256"] != source["baselineDecodedContentSHA256"] or (source["baselineOfficialContentVersion"] is not None and str(parsed["version"]) != str(source["baselineOfficialContentVersion"])):
            change = "ContentChanged"
        elif observation["rawResponseSHA256"] != source["baselineRawResponseSHA256"]:
            change = "TransportOnlyChanged"
        else:
            change = "Unchanged"
        if snapshot_dir:
            directory = Path(snapshot_dir) / observation["rawResponseSHA256"]
            immutable_write(directory / "response.json", raw)
            immutable_write(directory / ("content.pdf" if parsed["mime"] == "application/pdf" else "content.html"), parsed["decoded"])
        observation.update({"result": "Verified", "parseVerified": True, "change": change})
    except Exception as exc:  # Each failed source remains explicit; other sources can still finish.
        if isinstance(exc, urllib.error.HTTPError):
            observation["httpStatus"] = exc.code
        observation["error"] = f"{type(exc).__name__}: {str(exc)[:800]}"
    observation["checkedAt"] = now()
    return observation


def run_check(sources, *, timeout=20, max_bytes=8 * 1024 * 1024, snapshot_dir=None, workers=3, fetcher=fetch_source):
    started = now()
    batch_id = f'legal-watch:{started[:10]}:{uuid.uuid4().hex}'
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        observations = list(pool.map(lambda s: fetcher(s, batch_id=batch_id, timeout=timeout, max_bytes=max_bytes, snapshot_dir=snapshot_dir), sources))
    return {"schemaVersion": 1, "kind": "GYSOfficialSourceCheck", "id": batch_id, "startedAt": started, "completedAt": now(),
            "requestedTopicIds": [s["topicId"] for s in sources], "observations": observations,
            "complete": bool(observations) and all(o["result"] == "Verified" and o["parseVerified"] for o in observations),
            "legalEdition": "preparation", "examCutoffDate": CUTOFF, "examVersionFinalized": False}


def write_report(report, output, observations_dir):
    encoded = (json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    # Every run is retained before replacing the convenient latest pointer.
    immutable_write(Path(observations_dir) / (report["id"].replace(":", "-") + ".json"), encoded)
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=output.parent, delete=False) as stream:
        stream.write(encoded)
        tmp = Path(stream.name)
    os.replace(tmp, output)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", type=Path, default=ROOT / "data/official-source-registry.json")
    parser.add_argument("--topics", nargs="+", help="Optional subset; default is all 23 legal topics")
    parser.add_argument("--output", type=Path, default=ROOT / ".local-reports/legal-watch.json")
    parser.add_argument("--observations-dir", type=Path, default=ROOT / ".local-reports/legal-watch-observations")
    parser.add_argument("--snapshot-dir", type=Path, default=ROOT / ".local-sources/legal-watch")
    parser.add_argument("--timeout", type=float, default=20)
    parser.add_argument("--max-bytes", type=int, default=8 * 1024 * 1024)
    parser.add_argument("--workers", type=int, default=3)
    args = parser.parse_args()
    if not 1 <= args.timeout <= 30 or not 1024 <= args.max_bytes <= MAX_RESPONSE_BYTES or not 1 <= args.workers <= 4:
        parser.error("Timeout 1–30s, byte limit 1KiB–16MiB and workers 1–4 required")
    sources = registry_sources(args.registry)
    if args.topics:
        requested = set(args.topics)
        if len(requested) != len(args.topics) or not requested.issubset({s["topicId"] for s in sources}):
            parser.error("Requested topics must be unique registered legal topics; O04 has no legal instrument")
        sources = [s for s in sources if s["topicId"] in requested]
    report = run_check(sources, timeout=args.timeout, max_bytes=args.max_bytes, snapshot_dir=args.snapshot_dir, workers=args.workers)
    write_report(report, args.output, args.observations_dir)
    print(json.dumps({"complete": report["complete"], "verified": sum(o["result"] == "Verified" for o in report["observations"]), "requested": len(sources), "contentChanges": sum(o["change"] == "ContentChanged" for o in report["observations"]), "output": str(args.output), "examVersionFinalized": False}))
    return 0 if report["complete"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
