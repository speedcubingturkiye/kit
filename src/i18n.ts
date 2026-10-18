// Interface texts and event names in Turkish and English.

export type Lang = 'tr' | 'en';

export const TEXT = {
  tr: {
    tagline: 'Yarışma hazırlık aracı',
    compLabel: 'WCA yarışma kimliği',
    compHint: 'Yarışmanın WCA sayfasının adresindeki kimlik, örneğin NewAgeTurkey2026.',
    load: 'Yükle',
    orFile: 'ya da WCIF dosyası seç',
    loading: 'Yükleniyor…',
    notFound: 'Bu kimlikle bir yarışma bulunamadı.',
    httpError: 'WCA yanıt vermedi ({status}). Biraz sonra tekrar deneyin.',
    netError: 'WCA’ya ulaşılamadı. Bağlantıyı kontrol edip tekrar deneyin.',
    badFile: 'Dosya okunamadı: geçerli bir WCIF değil.',
    empty: 'Bir yarışma yükleyin. Yaka kartı, derece belgesi ve skor kartı bu listeden üretilecek.',
    people: '{n} kişi',
    days: '{n} gün',
    noGroups: 'Henüz grup ataması yok',
    colNo: 'No',
    colName: 'Ad',
    colWcaId: 'WCA ID',
    colCountry: 'Ülke',
    colRole: 'Rol',
    colGroups: 'Gruplar ve görevler',
    newcomer: 'İlk yarışma',
    group: 'G{n}',
    station: 'M{n}',
    privacy: 'Veriler yalnızca bu tarayıcıda işlenir ve hiçbir sunucuya gönderilmez. Özel WCIF dosyasındaki doğum tarihi ve e-posta yüklenir yüklenmez silinir.',
    credit: 'Badgifier’dan (MIT, Dallas McNeil) türetilmiştir. Branş ikonları cubing/icons’tan, bayraklar country-flag-icons’tan alınmıştır.',
    licences: 'Lisanslar',
    roles: { delegate: 'Delege', 'trainee-delegate': 'Aday delege', organizer: 'Organizatör', staff: 'Görevli', competitor: 'Yarışmacı' },
    viewPeople: 'Kişiler',
    viewBadges: 'Yaka kartları',
    design: 'Tasarım',
    size: 'Boyut',
    orientation: 'Yön',
    portrait: 'Dikey',
    landscape: 'Yatay',
    cardLang: 'Kart dili',
    cardEn: 'İngilizce',
    cardTrEn: 'Türkçe + İngilizce',
    print: 'Yazdır / PDF',
    printNote: 'Her kartın ön ve arka yüzü ayrı sayfadır; her kenarda 3 mm taşma payı vardır. Yazdırma penceresinde hedef olarak “PDF olarak kaydet”i seçin.',
    qrNote: 'Arka yüzdeki QR: {url}',
    qrWcaLive: 'Bu bağlantı, delege yarışmayı WCA Live’a aktardıktan sonra çalışır.',
  },
  en: {
    tagline: 'Competition prep kit',
    compLabel: 'WCA competition ID',
    compHint: 'The ID in the address of the competition’s WCA page, for example NewAgeTurkey2026.',
    load: 'Load',
    orFile: 'or choose a WCIF file',
    loading: 'Loading…',
    notFound: 'No competition has this ID.',
    httpError: 'The WCA did not respond ({status}). Try again in a moment.',
    netError: 'Could not reach the WCA. Check the connection and try again.',
    badFile: 'Could not read the file: it is not a valid WCIF.',
    empty: 'Load a competition. Badges, certificates and scorecards will be made from this list.',
    people: '{n} people',
    days: '{n} days',
    noGroups: 'No group assignments yet',
    colNo: 'No',
    colName: 'Name',
    colWcaId: 'WCA ID',
    colCountry: 'Country',
    colRole: 'Role',
    colGroups: 'Groups and tasks',
    newcomer: 'Newcomer',
    group: 'G{n}',
    station: 'S{n}',
    privacy: 'Data is processed only in this browser and is never sent to a server. Birth dates and e-mails in a private WCIF are deleted as soon as it loads.',
    credit: 'Derived from Badgifier (MIT, Dallas McNeil). Event icons from cubing/icons, flags from country-flag-icons.',
    licences: 'Licences',
    roles: { delegate: 'Delegate', 'trainee-delegate': 'Trainee delegate', organizer: 'Organizer', staff: 'Staff', competitor: 'Competitor' },
    viewPeople: 'People',
    viewBadges: 'Badges',
    design: 'Design',
    size: 'Size',
    orientation: 'Orientation',
    portrait: 'Portrait',
    landscape: 'Landscape',
    cardLang: 'Badge language',
    cardEn: 'English',
    cardTrEn: 'Turkish + English',
    print: 'Print / PDF',
    printNote: 'Each badge prints its front and back on separate pages, with 3 mm bleed on every edge. In the print dialog, choose “Save as PDF” as the destination.',
    qrNote: 'QR on the back: {url}',
    qrWcaLive: 'This link works once the delegate has imported the competition into WCA Live.',
  },
} as const;

// Task letters as on the badges: J judge, S scrambler, R runner (same in both languages), plus D data entry, A announcer.
export const TASK_LETTER = { judge: 'J', scrambler: 'S', runner: 'R', dataentry: 'D', announcer: 'A', other: '?' } as const;

// Event names: short label, Turkish, English. The Turkish names of events not yet on the designs are proposals.
export const EVENTS: Record<string, [string, string, string]> = {
  '333': ['3x3', '3x3x3 Küp', '3x3x3 Cube'],
  '222': ['2x2', '2x2x2 Küp', '2x2x2 Cube'],
  '444': ['4x4', '4x4x4 Küp', '4x4x4 Cube'],
  '555': ['5x5', '5x5x5 Küp', '5x5x5 Cube'],
  '666': ['6x6', '6x6x6 Küp', '6x6x6 Cube'],
  '777': ['7x7', '7x7x7 Küp', '7x7x7 Cube'],
  '333bf': ['3BLD', '3x3x3 Gözü Kapalı', '3x3x3 Blindfolded'],
  '333fm': ['FMC', '3x3x3 En Az Hamle', '3x3x3 Fewest Moves'],
  '333oh': ['OH', '3x3x3 Tek El', '3x3x3 One-Handed'],
  clock: ['Clock', 'Clock', 'Clock'],
  minx: ['Mega', 'Megaminx', 'Megaminx'],
  pyram: ['Pyra', 'Pyraminx', 'Pyraminx'],
  skewb: ['Skewb', 'Skewb', 'Skewb'],
  sq1: ['SQ1', 'Square-1', 'Square-1'],
  '444bf': ['4BLD', '4x4x4 Gözü Kapalı', '4x4x4 Blindfolded'],
  '555bf': ['5BLD', '5x5x5 Gözü Kapalı', '5x5x5 Blindfolded'],
  '333mbf': ['MBLD', '3x3x3 Çoklu Gözü Kapalı', '3x3x3 Multi-Blind'],
  fto: ['FTO', 'FTO', 'FTO'],
};

export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function fill(s: string, values: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));
}
