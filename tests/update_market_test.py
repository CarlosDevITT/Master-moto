import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('market_updater', Path(__file__).resolve().parents[1] / 'tools/update-market.py')
updater = importlib.util.module_from_spec(spec)
spec.loader.exec_module(updater)

def page(headers, counts):
    return '\n'.join(headers) + '\n' + '\n'.join(
        f'{rank}º BRAND/MODEL{group}{rank} 1 0,00 = 10 {100 / count:.2f}%'.replace('.', ',')
        for group, count in enumerate(counts) for rank in range(1, count + 1))

class RankingValidation(unittest.TestCase):
    def test_complete_segments_and_zero_month(self):
        headers, models = updater.extract_rankings(page(['City', 'Custom', 'Trail/Fun'], [10, 10, 10]))
        self.assertEqual(headers, ['City', 'Custom', 'Trail/Fun'])
        self.assertEqual(len(models), 30)
        self.assertEqual(models[0]['monthly'], 0)

    def test_missing_segment(self):
        with self.assertRaises(ValueError):
            updater.extract_rankings(page(['City', 'Custom', 'Trail/Fun'], [10, 10]))

    def test_missing_row(self):
        with self.assertRaises(ValueError):
            updater.extract_rankings(page(['City'], [9]))

    def test_unrecognized_row(self):
        with self.assertRaises(ValueError):
            updater.extract_rankings(page(['City'], [10]).replace('BRAND/MODEL01', 'BROKEN'))

    def test_short_touring_requires_full_segment_share(self):
        self.assertEqual(len(updater.extract_rankings(page(['Touring'], [7]))[1]), 7)
        with self.assertRaises(ValueError):
            updater.extract_rankings(page(['Touring'], [7]).replace('14,29%', '10,00%'))

    def test_extract_rejects_whole_missing_segment(self):
        class Page:
            def extract_text(self):
                return 'Emplacamento Motocicletas Setembro/2026\nMotos 200.000 100.000 2.000.000\nModelos mais emplacados acumulado\n' + page(['City', 'Custom', 'Trail/Fun', 'Maxtrail', 'Naked/Roadster', 'Scooter/Cub', 'Sport'], [10] * 7)
        original = updater.PdfReader
        updater.PdfReader = lambda _: type('Reader', (), {'pages': [Page()]})()
        try:
            with self.assertRaises(ValueError):
                updater.extract(b'', 'source', '2026-09')
        finally:
            updater.PdfReader = original

if __name__ == '__main__':
    unittest.main()
