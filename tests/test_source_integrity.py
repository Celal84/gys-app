"""Meaningful safety/structure diagnostics; no legal question fixtures."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

MODULE_PATH = Path(__file__).resolve().parents[1] / 'scripts/source-integrity.py'
SPEC = importlib.util.spec_from_file_location('source_integrity', MODULE_PATH)
audit = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(audit)


class SourceIntegrityTests(unittest.TestCase):
    def test_excluded_id_and_escape_rejected_before_read(self):
        with self.assertRaisesRegex(ValueError, 'Excluded'):
            audit.guarded_path(str(audit.PRIVATE / audit.EXCLUDED / 'source.doc'))
        with self.assertRaisesRegex(ValueError, 'Only local'):
            audit.guarded_path('/tmp/unrelated.doc')

    def test_similarly_named_file_is_not_name_excluded(self):
        self.assertEqual(audit.guarded_path(str(audit.PRIVATE / 'İlerleme adlı izinli ders notu.txt')).name,
                         'İlerleme adlı izinli ders notu.txt')

    def test_symlink_cannot_escape_snapshot_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            allowed = Path(directory) / 'allowed'
            allowed.mkdir()
            outside = Path(directory) / 'outside.txt'
            outside.write_text('outside')
            (allowed / 'alias.txt').symlink_to(outside)
            with patch.object(audit, 'PRIVATE', allowed):
                with self.assertRaisesRegex(ValueError, 'Only local'):
                    audit.guarded_path(str(allowed / 'alias.txt'))

    def test_ooxml_preserves_table_and_detects_unresolved_note(self):
        ns = audit.WORD_NS['w']
        doc = f'''<w:document xmlns:w="{ns}"><w:body><w:p><w:r><w:t>Test</w:t><w:footnoteReference w:id="2"/><w:footnoteReference w:id="3"/></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>'''
        notes = f'''<w:footnotes xmlns:w="{ns}"><w:footnote w:id="0" w:type="separator"/><w:footnote w:id="2"><w:p><w:r><w:t>Note</w:t></w:r></w:p></w:footnote></w:footnotes>'''
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'fixture.docx'
            with zipfile.ZipFile(path, 'w') as archive:
                archive.writestr('word/document.xml', doc)
                archive.writestr('word/footnotes.xml', notes)
            result = audit.docx_structure(path)
            self.assertEqual(result['tables'], 1)
            self.assertEqual(result['tableCells'], 1)
            self.assertEqual(result['footnoteDefinitions'], 1)
            self.assertEqual(result['unresolvedFootnoteIds'], ['3'])
            self.assertIn('Note', result['allText'])

    def test_diagnostic_does_not_silently_correct_concatenated_article_number(self):
        result = audit.compare_text('Geçici Madde 32314 — Ancak', 'Geçici Madde 32 — Ancak')
        self.assertEqual(result['articleNumbersMissingInDerived'], [32314])
        self.assertEqual(result['derivedArticleNumbers'], [32])
        self.assertEqual(result['derivedExceptionWordCount'], 1)

    def test_html_tables_and_note_anchors_remain_inspectable(self):
        parser = audit.HTMLStructure()
        parser.feed('<table><tr><td>Text</td></tr></table><a href="#_ftn1">1</a><a name="_ftn1">Note</a>')
        self.assertEqual(parser.tables, 1)
        self.assertEqual(parser.cells, 1)
        self.assertEqual(set(parser.refs) - parser.anchors, set())


if __name__ == '__main__':
    unittest.main()
