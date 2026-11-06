"""Synthetic HTTP fixtures are never counted as verified educational content."""
import base64
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
import urllib.error

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("legal_watch", ROOT / "scripts/check-official-sources.py")
watch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(watch)


def envelope(content=None, version=503, extra=None):
    if content is None:
        content = ('<html><head><meta charset="Windows-1254"></head><body><p>DEVLET MEMURLARI KANUNU</p><p>Madde 1 – Synthetic test fixture.</p><p>' + 'Güvenilir bağımsız doğrulama testi. ' * 40 + '</p></body></html>').encode()
    return json.dumps({"data": {"content": base64.b64encode(content).decode(), "mimeType": "text/html", "version": version}, **(extra or {})}).encode()


class Response(io.BytesIO):
    def __init__(self, content, status=200, headers=None):
        super().__init__(content)
        self.status = status
        self.headers = headers or {}


class LegalWatchTest(unittest.TestCase):
    def setUp(self):
        self.source = next(x for x in watch.registry_sources(ROOT / 'data/official-source-registry.json') if x['topicId'] == 'O02')
        raw = envelope()
        self.source['baselineRawResponseSHA256'] = watch.sha(raw)
        self.source['baselineDecodedContentSHA256'] = watch.sha(watch.parse_response(raw, self.source['title'])['decoded'])

    def fetch(self, raw, **options):
        return watch.fetch_source(self.source, batch_id='synthetic-test', opener=lambda *_args, **_kwargs: Response(raw), **options)

    def test_registry_uses_exact_ids_and_real_types_without_history_or_drive(self):
        sources = watch.registry_sources(ROOT / 'data/official-source-registry.json')
        self.assertEqual(len(sources), 23)
        self.assertNotIn('O04', [x['topicId'] for x in sources])
        self.assertEqual(next(x for x in sources if x['topicId'] == 'T08')['type'], 'KKY')
        self.assertEqual(next(x for x in sources if x['topicId'] == 'O15')['documentId'], '103459')
        self.assertFalse(any('drive.google' in x['sourceUrl'] for x in sources))

    def test_real_http_parse_and_unknown_legal_dates_are_separate(self):
        observed = self.fetch(envelope())
        self.assertEqual(observed['result'], 'Verified')
        self.assertEqual(observed['change'], 'Unchanged')
        self.assertTrue(observed['parseVerified'])
        self.assertEqual(observed['officialContentVersion'], 503)
        self.assertIsNone(observed['legalDates']['effectiveFrom'])
        self.assertIsNone(observed['legalDates']['amendmentPublicationDate'])
        self.assertEqual(observed['legalDates']['transitionReviewStatus'], 'Pending')

    def test_empty_response_and_http_200_shell_are_never_success(self):
        for raw in (b'', b'<html><div id="app"></div><script>boot()</script></html>', b'{"data":null,"metadata":{"error":"blocked"}}'):
            observed = self.fetch(raw)
            self.assertEqual(observed['result'], 'Failed')
            self.assertFalse(observed['parseVerified'])
            self.assertIsNotNone(observed['error'])

    def test_wrong_instrument_title_malformed_base64_and_fake_pdf_fail(self):
        for raw in (envelope(b'<html><p>OTHER LAW</p><p>Madde 1</p><p>' + b'word ' * 200 + b'</p></html>'), b'{"data":{"content":"not base64","version":1}}'):
            self.assertEqual(self.fetch(raw)['result'], 'Failed')
        with self.assertRaisesRegex(ValueError, 'PDF signature'):
            watch.document_text(b'not a PDF', 'application/pdf')

    def test_official_title_circumflex_and_dotted_i_are_not_lossy_byte_edits(self):
        self.assertEqual(watch.normalized('İSKAN KANUNU'), watch.normalized('İSKÂN KANUNU'))
        self.assertEqual(watch.normalized('KAMU MALİ YÖNETİMİ'), watch.normalized('KAMU MALÎ YÖNETİMİ'))

    def test_read_is_bounded_and_http_non_200_is_failure(self):
        self.assertEqual(self.fetch(envelope(), max_bytes=1024)['result'], 'Failed')
        observed = watch.fetch_source(self.source, batch_id='test', opener=lambda *_a, **_k: Response(envelope(), status=403))
        self.assertEqual(observed['httpStatus'], 403)
        self.assertEqual(observed['result'], 'Failed')

    def test_transport_change_and_actual_version_change_are_distinct(self):
        self.assertEqual(self.fetch(envelope(extra={'metadata': {'technicalTimestamp': 'different'}}))['change'], 'TransportOnlyChanged')
        self.assertEqual(self.fetch(envelope(version=504))['change'], 'ContentChanged')
        self.assertEqual(self.fetch(envelope(content=watch.parse_response(envelope(), self.source['title'])['decoded'].replace(b'fixture', b'changed')))['change'], 'ContentChanged')

    def test_offline_error_cannot_finish_batch_successfully(self):
        def failed_opener(*_args, **_kwargs):
            raise urllib.error.URLError('offline')

        def fetcher(source, **options):
            return watch.fetch_source(source, opener=failed_opener, **options)

        report = watch.run_check([self.source], fetcher=fetcher)
        self.assertFalse(report['complete'])
        self.assertFalse(report['examVersionFinalized'])
        self.assertIsNone(report['observations'][0]['rawResponseSHA256'])
        self.assertIn('offline', report['observations'][0]['error'])

    def test_snapshots_and_observations_append_immutably(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            self.assertEqual(self.fetch(envelope(), snapshot_dir=directory / 'sources')['result'], 'Verified')
            self.assertEqual(self.fetch(envelope(), snapshot_dir=directory / 'sources')['result'], 'Verified')
            report = watch.run_check([self.source], fetcher=lambda source, **options: watch.fetch_source(source, opener=lambda *_a, **_k: Response(envelope()), **options))
            watch.write_report(report, directory / 'latest.json', directory / 'observations')
            watch.write_report(report, directory / 'latest.json', directory / 'observations')
            self.assertEqual(len(list((directory / 'observations').glob('*.json'))), 1)
            self.assertEqual(len(list((directory / 'sources').glob('*'))), 1)
            changed = dict(report, complete=False)
            with self.assertRaisesRegex(ValueError, 'Immutable snapshot conflict'):
                watch.write_report(changed, directory / 'latest.json', directory / 'observations')
            self.assertTrue(json.loads((directory / 'latest.json').read_text())['complete'])

    def test_redirects_cannot_escape_official_tls_host(self):
        handler = watch.NoExternalRedirect()
        with self.assertRaises(ValueError):
            handler.redirect_request(None, None, 302, 'redirect', {}, 'https://untrusted.test/')


if __name__ == '__main__':
    unittest.main()
