"""Extract visible flow without inventing spaces around inline statutory footnotes."""
from html.parser import HTMLParser
import json
import sys


class OfficialText(HTMLParser):
    BLOCKS = {'p', 'div', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'section', 'article'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)

    def handle_starttag(self, tag, attrs):
        if tag in self.BLOCKS or tag == 'br':
            self.parts.append('\n')

    def handle_endtag(self, tag):
        if tag in self.BLOCKS:
            self.parts.append('\n')

    def text(self):
        return '\n'.join(line.strip() for line in ''.join(self.parts).splitlines() if line.strip())


def extract(html):
    parser = OfficialText()
    parser.feed(html)
    return parser.text()


if __name__ == '__main__':
    result = {}
    for filename in sys.argv[1:]:
        with open(filename, encoding='utf-8') as source:
            result[filename] = extract(source.read())
    print(json.dumps(result, ensure_ascii=False))
