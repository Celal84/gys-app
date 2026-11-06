import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('official_html', Path(__file__).parents[1] / 'scripts/extract_official_html.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class OfficialHtmlTests(unittest.TestCase):
    def test_inline_footnote_does_not_gain_artificial_space(self):
        self.assertEqual(module.extract('<p>Metin (…)<a><span>[187]</span></a> devam</p><p>İkinci paragraf</p>'), 'Metin (…)[187] devam\nİkinci paragraf')

    def test_inline_emphasis_preserves_original_whitespace(self):
        self.assertEqual(module.extract('<p><b>savunma</b> hakkı</p>'), 'savunma hakkı')
        self.assertEqual(module.extract('<p>bir<b>leşik</b></p>'), 'birleşik')

    def test_blocks_and_entities_keep_semantic_boundaries(self):
        self.assertEqual(module.extract('<p>A &amp; B<br>C</p><p>D</p>'), 'A & B\nC\nD')


if __name__ == '__main__':
    unittest.main()
