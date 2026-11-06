#!/usr/bin/env python3
"""Turns the SDG Word templates into app templates for the mock seeds (src/lib/mock/brand/).

The brand originals (sdg-einladung.dotx, sdg-protokoll.dotx) stay untouched. Their [..] fields become the server's
placeholders ({{Wann}}, {{Ort}}, ...; meetings.domain.AgendaDocument); what the app does not know (convener, bank,
statute references, task table) is left out. sdg-dokument.dotx is copied as the club's letter template.

    python3 scripts/brand-templates.py /data1/Dokumente/Verein/design/brand/templates src/lib/mock/brand
"""
import re
import shutil
import sys
import zipfile
from pathlib import Path

PARAGRAPH = re.compile(r'<w:p[ >].*?</w:p>', re.S)
TEXT = re.compile(r'<w:t(?: [^>]*)?>(.*?)</w:t>', re.S)
KNOWN = {'Verein', 'Adresse', 'Webseite', 'Kontakt', 'Registernummer', 'Sitzung', 'Art', 'Titel', 'Wann', 'Ort', 'Video',
         'Dringlichkeit', 'Tagesordnung', 'Versandt', 'Anwesend', 'Beschlussfähig', 'Agenda', 'Beschlüsse', 'Vorsitz',
         'Schriftführer'}
DROP = None

FOOTER = [
    ('Soli Deo Gloria Volleyball Vienna', '{{Verein}}'),
    ('[Straße Hausnummer]', '{{Adresse}}'),
    ('[PLZ] Wien', DROP),
    ('[E-Mail-Adresse]', '{{Kontakt}}'),
    ('[www.webseite.at]', '{{Webseite}}'),
    ('Vorsitz: [Vorname Nachname]', DROP),
    ('[Name der Bank]', DROP),
    ('IBAN [AT00 0000 0000 0000 0000]', DROP),
    ('BIC [XXXXXXXXXXX]', DROP),
    ('ZVR-Zahl [000000000]', 'ZVR-Zahl {{Registernummer}}'),
]

INVITATION = {
    'rows': ['Einberufen durch'],
    'tables': [],
    'document': [
        ('zur [ordentlichen Mitgliederversammlung]  ·  Wien, [TT.MM.JJJJ]', 'zur {{Art}}  ·  {{Versandt}}'),
        ('[Ordentliche Mitgliederversammlung / Vorstandssitzung]', '{{Sitzung}}'),
        ('[Wochentag], [TT.MM.JJJJ], [hh:mm] – ca. [hh:mm] Uhr', '{{Wann}}'),
        ('[Adresse, Raum]', '{{Ort}}'),
        ('[Link zur Videokonferenz]', '{{Video}}'),
        ('hiermit laden wir euch gemäß [§ 8 Abs. 4] der Statuten herzlich zur [ordentlichen Mitgliederversammlung] ein. '
         'Wir freuen uns auf euch!', ['hiermit laden wir euch herzlich zur {{Art}} ein. Wir freuen uns auf euch!',
                                    'Grund der Dringlichkeit: {{Dringlichkeit}}']),
        ('Begrüßung und Feststellung der Beschlussfähigkeit', '{{Tagesordnung}}'),
        ('Genehmigung der Tagesordnung', DROP),
        ('Genehmigung des Protokolls der letzten Sitzung', DROP),
        ('[Bericht des Vorstands]', DROP),
        ('[Tagesordnungspunkt]', DROP),
        ('Allfälliges', DROP),
        ('Anträge zur Tagesordnung bitte bis [TT.MM.JJJJ] schriftlich an [E-Mail-Adresse].',
         'Anträge zur Tagesordnung bitte schriftlich an {{Kontakt}}.'),
        ('Stimmberechtigt sind [die ordentlichen Mitglieder] (§ 8 Abs. 1 der Statuten).', DROP),
        ('Unterlagen: [Protokoll der letzten Sitzung, Rechnungsabschluss] – liegen bei.', DROP),
        ('Bitte gebt bis [TT.MM.JJJJ] Bescheid, ob ihr teilnehmt.', 'Bitte gebt Bescheid, ob ihr teilnehmt.'),
        ('[Vorname Nachname]', 'Der Vorstand'),
        ('[Funktion im Verein]', DROP),
    ],
    'footer': FOOTER + [('Einladung [TT.MM.JJJJ]', 'Einladung {{Versandt}}')],
}

PROTOCOL = {
    'rows': ['Entschuldigt', 'Gäste'],
    'tables': ['Verantwortlich'],
    'document': [
        ('der [ordentlichen Mitgliederversammlung]  ·  [Ort], [TT.MM.JJJJ]', 'der {{Art}}  ·  {{Sitzung}}'),
        ('[TT.MM.JJJJ], [hh:mm] – [hh:mm] Uhr', '{{Wann}}'),
        ('[Adresse, Raum] / [online]', '{{Ort}}'),
        # In order: Sitzungsleitung and Protokoll at the top, then the two signatures.
        ('[Vorname Nachname]', '{{Vorsitz}}'),
        ('[Vorname Nachname]', '{{Schriftführer}}'),
        ('[Namen] – davon online: [Namen]', '{{Anwesend}}'),
        ('[ja] – [X] von [Y] Stimmberechtigten anwesend', '{{Beschlussfähig}}'),
        ('Begrüßung und Feststellung der Beschlussfähigkeit', 'Tagesordnung'),
        ('[Vorname Nachname] eröffnet die Sitzung um [hh:mm] Uhr, begrüßt die Anwesenden und stellt die ordnungsgemäße '
         'Einberufung sowie die Beschlussfähigkeit fest.', '{{Agenda}}'),
        ('Genehmigung der Tagesordnung', 'Beschlüsse'),
        ('Beschluss: Die Tagesordnung wird in der vorliegenden Form genehmigt.', '{{Beschlüsse}}'),
        ('Abstimmung: [X] dafür · [X] dagegen · [X] Enthaltungen – angenommen', DROP),
        ('[Tagesordnungspunkt]', 'Protokoll'),
        ('[Kurze Zusammenfassung von Bericht und Diskussion. Wer hat was berichtet, welche Argumente wurden genannt.]',
         '{{Tagesordnung}}'),
        ('Beschluss: [Wortlaut des Beschlusses]', DROP),
        ('Abstimmung: [X] dafür · [X] dagegen · [X] Enthaltungen – [angenommen / abgelehnt]', DROP),
        ('Allfälliges', DROP),
        ('[Wortmeldungen ohne Beschluss.]', DROP),
        ('Ende der Sitzung: [hh:mm] Uhr.', DROP),
        ('Aufgaben', DROP),
        ('[Ort], [TT.MM.JJJJ]', DROP),
        ('[Vorname Nachname]', '{{Schriftführer}}'),
        ('[Vorname Nachname]', '{{Vorsitz}}'),
    ],
    'footer': FOOTER + [('Protokoll [TT.MM.JJJJ]', 'Protokoll {{Sitzung}}')],
}


def text_of(xml):
    return ''.join(TEXT.findall(xml)).replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')


def escape(text):
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def rewrite(paragraph, text):
    """One run in the paragraph's first run format; paragraph properties stay."""
    start = re.match(r'<w:p[^>]*>', paragraph).group()
    props = re.search(r'<w:pPr>.*?</w:pPr>', paragraph, re.S)
    rest = paragraph[props.end():] if props else paragraph
    run = re.search(r'<w:rPr>.*?</w:rPr>', rest, re.S)
    return (f'{start}{props.group() if props else ""}<w:r>{run.group() if run else ""}'
            f'<w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>')


def convert_part(xml, rules, drop_rows, drop_tables):
    for marker in drop_tables:
        xml = re.sub(r'<w:tbl>(?:(?!<w:tbl>).)*?</w:tbl>', lambda t: '' if marker in text_of(t.group()) else t.group(), xml, flags=re.S)
    for marker in drop_rows:
        xml = re.sub(r'<w:tr[ >].*?</w:tr>', lambda r: '' if text_of(r.group()).startswith(marker) else r.group(), xml, flags=re.S)
    pending = list(rules)

    def replace(match):
        paragraph = match.group()
        text = text_of(paragraph).strip()
        for i, (old, new) in enumerate(pending):
            if text == old:
                del pending[i]
                if new is DROP:
                    return ''
                return ''.join(rewrite(paragraph, line) for line in (new if isinstance(new, list) else [new]))
        return paragraph

    xml = PARAGRAPH.sub(replace, xml)
    if pending:
        raise SystemExit(f'not found: {[old for old, _ in pending]}')
    # Word refuses a cell without a paragraph.
    return re.sub(r'(</w:tcPr>|<w:tc>)\s*</w:tc>', r'\1<w:p/></w:tc>', xml)


def convert(source, target, spec):
    with zipfile.ZipFile(source) as zin, zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == 'word/document.xml':
                data = convert_part(data.decode(), spec['document'], spec['rows'], spec['tables']).encode()
            elif re.fullmatch(r'word/footer\d*\.xml', item.filename):
                data = convert_part(data.decode(), spec['footer'], [], []).encode()
            if item.filename.startswith('word/') and item.filename.endswith('.xml'):
                left = set(re.findall(r'\{\{\s*(\w+)\s*\}\}', text_of(data.decode())))
                assert left <= KNOWN, f'{target.name}: unknown placeholders {left - KNOWN}'
                assert '[' not in text_of(data.decode()) or item.filename != 'word/document.xml', f'{target.name}: [..] left'
            zout.writestr(item, data)


def main():
    source, out = Path(sys.argv[1]), Path(sys.argv[2])
    convert(source / 'sdg-einladung.dotx', out / 'Einladung Sitzung.dotx', INVITATION)
    convert(source / 'sdg-protokoll.dotx', out / 'Protokoll Sitzung.dotx', PROTOCOL)
    shutil.copyfile(source / 'sdg-dokument.dotx', out / 'Briefvorlage.dotx')


if __name__ == '__main__':
    main()
