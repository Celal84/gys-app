#!/usr/bin/env python3
"""Read-only audit of allowlisted lesson snapshots; does not approve legal content.

Run: python3 scripts/source-integrity.py [--convert-docx]
Originals remain unchanged. Derived files live only under .local-sources/.
"""
from __future__ import annotations
import argparse
from collections import Counter
from datetime import datetime, timezone
from hashlib import sha256
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import subprocess
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / '.local-sources'
EXCLUDED = '1L30mGITasaz_HJ-wAQadrn9Tzv81nR7I'
WORD_NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
W = '{' + WORD_NS['w'] + '}'
ARTICLE = re.compile(r'\b(?:(?:GEÇİCİ|EK)\s+)?MADDE\s+(\d+)', re.IGNORECASE)
TOKENS = re.compile(r'[^\W_]+', re.UNICODE)
EXCEPTIONS = re.compile(r'\b(?:ancak|hariç|istisna|müstesna|dışında)\b', re.IGNORECASE)


def guarded_path(value: str) -> Path:
    path = Path(value)
    path = path if path.is_absolute() else ROOT / path
    path = path.resolve()
    if EXCLUDED in path.parts or EXCLUDED in path.name:
        raise ValueError('Excluded folder ID is not readable')
    if not path.is_relative_to(PRIVATE.resolve()):
        raise ValueError('Only local lesson snapshot paths are permitted')
    return path


def digest(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()


def relative(path: Path) -> str:
    return str(path.relative_to(ROOT))


def docx_structure(path: Path) -> dict:
    """Keep OOXML relationships, footnotes and tables separately from flat text."""
    with zipfile.ZipFile(path) as archive:
        if sum(info.file_size for info in archive.infolist()) > 80 * 1024 * 1024:
            raise ValueError('Derived OOXML package exceeds audit size limit')
        document = ET.fromstring(archive.read('word/document.xml'))
        body = document.find('w:body', WORD_NS)
        if body is None:
            raise ValueError('Word body missing')
        main_text = '\n'.join(''.join(t.text or '' for t in p.findall('.//w:t', WORD_NS)) for p in body.findall('.//w:p', WORD_NS))
        footnotes = ET.fromstring(archive.read('word/footnotes.xml')) if 'word/footnotes.xml' in archive.namelist() else None
        definitions = {} if footnotes is None else {
            node.get(W + 'id'): ''.join(t.text or '' for t in node.findall('.//w:t', WORD_NS))
            for node in footnotes.findall('w:footnote', WORD_NS)
            if node.get(W + 'type') not in ('separator', 'continuationSeparator')
        }
        references = [node.get(W + 'id') for node in document.findall('.//w:footnoteReference', WORD_NS)]
        all_text = main_text + '\n' + '\n'.join(definitions.values())
        tables = document.findall('.//w:tbl', WORD_NS)
        return {
            'mainText': main_text,
            'allText': all_text,
            'paragraphs': len(body.findall('.//w:p', WORD_NS)),
            'tables': len(tables),
            'tableCells': len(document.findall('.//w:tc', WORD_NS)),
            'footnoteReferences': len(references),
            'footnoteDefinitions': len(definitions),
            'unresolvedFootnoteIds': sorted(set(references) - set(definitions)),
            'endnoteDefinitions': len(ET.fromstring(archive.read('word/endnotes.xml')).findall('w:endnote', WORD_NS)) if 'word/endnotes.xml' in archive.namelist() else 0,
        }


class HTMLStructure(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tables = self.cells = 0
        self.anchors: set[str] = set()
        self.refs: list[str] = []
        self.chunks: list[str] = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('style', 'script'):
            self.skip += 1
        if tag == 'table':
            self.tables += 1
        if tag in ('td', 'th'):
            self.cells += 1
        for key in ('id', 'name'):
            if attrs.get(key):
                self.anchors.add(attrs[key])
        if tag == 'a' and attrs.get('href', '').startswith('#'):
            self.refs.append(attrs['href'][1:])

    def handle_endtag(self, tag):
        if tag in ('style', 'script'):
            self.skip = max(0, self.skip - 1)
        if tag in ('p', 'tr', 'h1', 'h2', 'h3'):
            self.chunks.append('\n')

    def handle_data(self, data):
        if not self.skip:
            self.chunks.append(data)


def tokenize(value: str) -> list[str]:
    return TOKENS.findall(value.casefold())


def compare_text(old: str, new: str) -> dict:
    previous, current = Counter(tokenize(old)), Counter(tokenize(new))
    overlap = sum((previous & current).values())
    old_count = sum(previous.values())
    old_articles, new_articles = set(ARTICLE.findall(old)), set(ARTICLE.findall(new))
    return {
        'previousTokens': old_count,
        'derivedTokens': sum(current.values()),
        'retainedPreviousTokenFraction': round(overlap / old_count, 6) if old_count else None,
        'previousArticleNumbers': sorted(map(int, old_articles)),
        'derivedArticleNumbers': sorted(map(int, new_articles)),
        'articleNumbersMissingInDerived': sorted(map(int, old_articles - new_articles)),
        'previousExceptionWordCount': len(EXCEPTIONS.findall(old)),
        'derivedExceptionWordCount': len(EXCEPTIONS.findall(new)),
        'replacementCharacters': new.count('\ufffd'),
        'note': 'Token overlap and article markers are diagnostics, not proof that wording, exceptions, tables or layout are legally complete.',
    }


def antiword_structure(raw: Path, output: Path) -> dict:
    binary = PRIVATE / 'antiword-runtime/usr/bin/antiword'
    if not binary.exists():
        return {'status': 'Unavailable'}
    env = {**os.environ, 'ANTIWORDHOME': str(PRIVATE / 'antiword-runtime/usr/share/antiword')}
    if not output.exists():
        result = subprocess.run([str(binary), '-m', 'UTF-8.txt', '-x', 'db', str(raw)], env=env, capture_output=True, timeout=90, check=True)
        output.write_bytes(result.stdout)
    root = ET.fromstring(output.read_bytes())
    text = ''.join(root.itertext())
    return {'status': 'Parsed', 'path': relative(output), 'tables': len(root.findall('.//informaltable')) + len(root.findall('.//table')),
            'tableCells': len(root.findall('.//entry')), 'footnotes': len(root.findall('.//footnote')),
            'textCharacters': len(text), 'xmlSha256': digest(output)}


def read_sources() -> list[dict]:
    common = json.loads((PRIVATE / 'common-read-report.json').read_text())['records']
    technical = json.loads((PRIVATE / 'technical-read-report.json').read_text())['files']
    return [{
        'id': r['id'], 'topicId': r['topic'], 'raw': r['rawPath'], 'text': r['textPath'], 'hash': r['sha256'],
        'isHtml': False, 'structure': None,
    } for r in common] + [{
        'id': r['driveFileId'], 'topicId': r['topicId'], 'raw': r['rawPath'], 'text': r['textPath'], 'hash': r['contentSha256'],
        'isHtml': 'HTML' in r['detectedFormat'], 'structure': r.get('structurePath'),
    } for r in technical]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--convert-docx', action='store_true', help='Generate local DOCX structure copies with LibreOffice; never change originals')
    args = parser.parse_args()
    sources = read_sources()
    if len(sources) != 24 or len({r['topicId'] for r in sources}) != 24:
        raise ValueError('Expected exactly 24 distinct curriculum source records')
    for record in sources:
        if record['id'] == EXCLUDED:
            raise ValueError('Excluded source is forbidden before file access')
    docx_dir, xml_dir, text_dir = (PRIVATE / name for name in ('structure-docx', 'structure-xml', 'structure-text'))
    for directory in (docx_dir, xml_dir, text_dir):
        directory.mkdir(exist_ok=True)
    if args.convert_docx:
        word_files = [str(guarded_path(r['raw'])) for r in sources if not r['isHtml'] and str(r['raw']).endswith('.doc')]
        subprocess.run(['soffice', f'-env:UserInstallation={(PRIVATE / "lo-structure-profile").as_uri()}', '--headless', '--convert-to', 'docx:Office Open XML Text', '--outdir', str(docx_dir), *word_files], check=True, timeout=240)
    results = []
    for record in sorted(sources, key=lambda r: r['topicId']):
        raw, previous_path = guarded_path(record['raw']), guarded_path(record['text'])
        before = digest(raw)
        if before != record['hash']:
            raise ValueError(f'Original snapshot hash mismatch: {record["topicId"]}')
        previous = previous_path.read_text()
        result = {'topicId': record['topicId'], 'sourceId': record['id'], 'rawPath': relative(raw), 'originalSha256': before,
                  'originalBytesUnchanged': True, 'legalApproval': False, 'fullVisualAudit': False}
        if record['isHtml']:
            structure_path = guarded_path(record['structure'])
            html = HTMLStructure()
            html.feed(structure_path.read_text())
            new = ''.join(html.chunks)
            refs = [ref for ref in html.refs if '_ftn' in ref.lower()]
            result.update(format='HTML', structurePath=relative(structure_path), tables=html.tables, tableCells=html.cells,
                          footnoteReferences=len(refs), unresolvedFootnoteIds=sorted(set(refs) - html.anchors),
                          comparison=compare_text(previous, new), status='StructureExtractedUnreviewed')
        elif raw.suffix.lower() == '.doc':
            structure_path = docx_dir / (raw.stem + '.docx')
            if not structure_path.exists():
                result.update(format='Word', status='StructureMissing', limitation='Run with --convert-docx after installing LibreOffice')
            else:
                structure = docx_structure(structure_path)
                new = structure.pop('allText')
                structure.pop('mainText')
                derived_text = text_dir / (record['id'] + '.txt')
                derived_text.write_text(new)
                second = antiword_structure(raw, xml_dir / (record['id'] + '.xml'))
                disagreements = []
                if second.get('status') == 'Parsed':
                    if second['tables'] != structure['tables']:
                        disagreements.append('table-count')
                    if second['footnotes'] != structure['footnoteDefinitions']:
                        disagreements.append('footnote-count')
                result.update(format='Word', structurePath=relative(structure_path), derivedTextPath=relative(derived_text), **structure,
                              secondExtractor=second, extractorDisagreements=disagreements,
                              comparison=compare_text(previous, new), status='ExtractorDiscrepancyNeedsReview' if disagreements else 'StructureExtractedUnreviewed')
        else:
            bbox = text_dir / (record['id'] + '.bbox.html')
            if not bbox.exists():
                subprocess.run(['pdftotext', '-bbox-layout', str(raw), str(bbox)], check=True, timeout=60, capture_output=True)
            page_root = ET.fromstring(bbox.read_bytes())
            ns = {'h': 'http://www.w3.org/1999/xhtml'}
            pages = page_root.findall('.//h:page', ns)
            result.update(format='PDF', pageCount=len(pages), bboxWordCount=len(page_root.findall('.//h:word', ns)),
                          structurePath=relative(bbox), status='OcrQualityReviewRequired' if record['topicId'] == 'O04' else 'PdfLayoutExtractedUnreviewed',
                          limitation='Bbox retains word/page coordinates; table and footnote semantics and image-only content require visual audit')
        if digest(raw) != before:
            raise ValueError('Original bytes changed during read-only audit')
        results.append(result)
    ocr_path = PRIVATE / 'ocr-audit-summary.json'
    ocr = json.loads(ocr_path.read_text()) if ocr_path.exists() else None
    if ocr:
        o04 = next(r for r in results if r['topicId'] == 'O04')
        o04.update(ocrRecovery=ocr, status=ocr['status'], sampledVisualPages=ocr['visualSamplePages'])
    t01 = next(r for r in results if r['topicId'] == 'T01')
    t01['sampledVisualPages'] = [1]
    t01['visualSampleScope'] = 'Page 1 heading, law number, publication date/number and first article layout inspected; no whole-document audit'
    timestamp = datetime.now(timezone.utc).isoformat()
    local = {'schemaVersion': 1, 'generatedAt': timestamp, 'purpose': 'Extraction integrity diagnostics; no legal approval', 'excludedBranchOpened': False,
             'allOriginalHashesMatch': all(r['originalBytesUnchanged'] for r in results), 'records': results}
    (PRIVATE / 'source-structure-audit.json').write_text(json.dumps(local, ensure_ascii=False, indent=2) + '\n')
    summary = {'schemaVersion': 1, 'generatedAt': timestamp, 'sourceCount': len(results), 'originalHashesVerified': len(results),
               'wordStructurePackages': sum(r['format'] == 'Word' and r['status'] != 'StructureMissing' for r in results),
               'htmlStructurePackages': sum(r['format'] == 'HTML' for r in results), 'pdfBboxPackages': sum(r['format'] == 'PDF' for r in results),
               'extractorDiscrepancies': sum(bool(r.get('extractorDisagreements')) for r in results),
               'fullVisualAudits': 0, 'legalApprovals': 0, 'excludedBranchOpened': False,
               'topics': [{k: r[k] for k in ('topicId', 'format', 'status', 'fullVisualAudit', 'legalApproval')} | {
                   'tables': r.get('tables'), 'footnoteDefinitions': r.get('footnoteDefinitions'),
                   'unresolvedFootnotes': len(r.get('unresolvedFootnoteIds', [])),
                   'extractorDisagreements': r.get('extractorDisagreements', []),
               } for r in results]}
    if ocr:
        summary['ocrRecovery'] = {key: ocr[key] for key in (
            'totalPages', 'completedPages', 'totalWords', 'meanPageWordConfidence', 'confidenceIsAccuracy',
            'visualSamplePages', 'status', 'legalApproval', 'fullVisualAudit', 'fullTextCompletenessApproved')}
        summary['ocrRecovery']['page2SamplePhraseMatches'] = {'old': ocr['exactSampledPhrases']['old'], 'new': ocr['exactSampledPhrases']['new'], 'total': ocr['exactSampledPhrases']['total']}
        summary['ocrRecovery']['page17LayoutSample'] = {'defaultHeadings': ocr['layoutSample']['defaultPsm3Matches'], 'thresholdHeadings': ocr['layoutSample']['threshold165Matches'], 'totalHeadings': ocr['layoutSample']['totalSocietyHeadings']}
    (ROOT / 'docs/source-integrity-summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in summary.items() if k != 'topics'}, ensure_ascii=False))


if __name__ == '__main__':
    main()
