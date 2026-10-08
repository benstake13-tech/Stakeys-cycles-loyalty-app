/**
 * Booking form translations.
 *
 * A rider can read the booking form in their own language before they fill it
 * in. The English strings stay the source of truth for the workshop: the
 * submitted booking, the staff card and the owner email are always written in
 * English, and only the *typed* free text is machine-translated on submit. That
 * way the mechanic never has to read Punjabi to fix a bike, and the rider never
 * has to guess what "Access / drop-off notes" means.
 */

export type LanguageCode =
  | 'en'
  | 'pl'
  | 'ro'
  | 'lt'
  | 'bg'
  | 'pt'
  | 'pa'
  | 'ur'
  | 'ar'
  | 'uk'
  | 'ru'
  | 'tr'
  | 'sq'
  | 'es';

export interface LanguageOption {
  code: LanguageCode;
  /** Endonym — the language's name in its own script, as a speaker recognises it. */
  label: string;
  /** English name, shown as a hint. */
  english: string;
  /** Right-to-left script (Arabic, Urdu) needs a dir switch on the form. */
  rtl?: boolean;
}

export const BOOKING_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', english: 'English' },
  { code: 'pl', label: 'Polski', english: 'Polish' },
  { code: 'ro', label: 'Română', english: 'Romanian' },
  { code: 'lt', label: 'Lietuvių', english: 'Lithuanian' },
  { code: 'bg', label: 'Български', english: 'Bulgarian' },
  { code: 'pt', label: 'Português', english: 'Portuguese' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', english: 'Punjabi' },
  { code: 'ur', label: 'اردو', english: 'Urdu', rtl: true },
  { code: 'ar', label: 'العربية', english: 'Arabic', rtl: true },
  { code: 'uk', label: 'Українська', english: 'Ukrainian' },
  { code: 'ru', label: 'Русский', english: 'Russian' },
  { code: 'tr', label: 'Türkçe', english: 'Turkish' },
  { code: 'sq', label: 'Shqip', english: 'Albanian' },
  { code: 'es', label: 'Español', english: 'Spanish' },
];

export const RTL_LANGUAGES: LanguageCode[] = ['ar', 'ur'];

export function isRtlLanguage(code: LanguageCode): boolean {
  return RTL_LANGUAGES.includes(code);
}

/**
 * Language preference is remembered per device so a rider who books in Polish
 * once is greeted in Polish next time.
 */
const LANGUAGE_STORAGE_KEY = 'stakeys_booking_language';

export function loadSavedLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && BOOKING_LANGUAGES.some((l) => l.code === saved)) {
      return saved as LanguageCode;
    }
  } catch {
    /* ignore */
  }
  return 'en';
}

export function saveLanguage(code: LanguageCode): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

/**
 * Keys used by the booking form. Add a key here and every dictionary below is
 * checked by the compiler, so a missing translation is a build error, not a
 * silent fall-back to English mid-form.
 */
export interface BookingPhrases {
  formHeading: string;
  languageLabel: string;
  languageHint: string;
  fullName: string;
  email: string;
  phone: string;
  bikeDetails: string;
  describeProblem: string;
  describeProblemPlaceholder: string;
  preferredDate: string;
  preferredTime: string;
  serviceType: string;
  dropOff: string;
  homeVisit: string;
  address: string;
  additionalDetails: string;
  additionalDetailsHint: string;
  accessNotes: string;
  accessNotesPlaceholder: string;
  extraDetail: string;
  extraDetailPlaceholder: string;
  preferredContact: string;
  contactCall: string;
  contactEmail: string;
  submitBooking: string;
  submitting: string;
  requiredNote: string;
  /** Explanatory line shown while a translation is being fetched/looked up. */
  translatingNote: string;
}

type Dictionary = Record<LanguageCode, BookingPhrases>;

export const BOOKING_PHRASES: Dictionary = {
  en: {
    formHeading: 'Book a workshop service',
    languageLabel: 'Language',
    languageHint: 'Read this form in your language',
    fullName: 'Full name',
    email: 'Email',
    phone: 'Phone',
    bikeDetails: 'Bike details',
    describeProblem: 'Describe the problem',
    describeProblemPlaceholder: 'e.g. Rear brake feels spongy, or I need it back before Friday',
    preferredDate: 'Preferred date',
    preferredTime: 'Preferred time',
    serviceType: 'Service type',
    dropOff: 'Drop off at workshop',
    homeVisit: 'Home visit / call-out',
    address: 'Address',
    additionalDetails: 'Additional details',
    additionalDetailsHint: 'Anything else the mechanic should know',
    accessNotes: 'Access / drop-off notes',
    accessNotesPlaceholder: 'e.g. Gate code 1234, leave with the front desk',
    extraDetail: 'Extra detail',
    extraDetailPlaceholder: 'e.g. I only ride it at weekends, last service was 8 months ago',
    preferredContact: 'Preferred contact',
    contactCall: 'Phone call',
    contactEmail: 'Email',
    submitBooking: 'Submit booking',
    submitting: 'Submitting…',
    requiredNote: 'Fields marked * are required',
    translatingNote: 'Your notes will be translated for the workshop.',
  },
  pl: {
    formHeading: 'Zamów serwis warsztatowy',
    languageLabel: 'Język',
    languageHint: 'Przeczytaj ten formularz w swoim języku',
    fullName: 'Imię i nazwisko',
    email: 'E-mail',
    phone: 'Telefon',
    bikeDetails: 'Dane roweru',
    describeProblem: 'Opisz problem',
    describeProblemPlaceholder: 'np. Tylny hamulec jest miękki lub potrzebuję go do piątku',
    preferredDate: 'Preferowana data',
    preferredTime: 'Preferowana godzina',
    serviceType: 'Rodzaj usługi',
    dropOff: 'Dostarczenie do warsztatu',
    homeVisit: 'Wizyta w domu / wyjazd',
    address: 'Adres',
    additionalDetails: 'Dodatkowe informacje',
    additionalDetailsHint: 'Wszystko, co mechanik powinien wiedzieć',
    accessNotes: 'Uwagi dotyczące dostępu / dostarczenia',
    accessNotesPlaceholder: 'np. Kod bramy 1234, zostaw w recepcji',
    extraDetail: 'Dodatkowy szczegół',
    extraDetailPlaceholder: 'np. Jeżdżę tylko w weekendy, ostatni serwis 8 miesięcy temu',
    preferredContact: 'Preferowany kontakt',
    contactCall: 'Telefon',
    contactEmail: 'E-mail',
    submitBooking: 'Wyślij zgłoszenie',
    submitting: 'Wysyłanie…',
    requiredNote: 'Pola oznaczone * są wymagane',
    translatingNote: 'Twoje uwagi zostaną przetłumaczone dla warsztatu.',
  },
  ro: {
    formHeading: 'Programează un service',
    languageLabel: 'Limbă',
    languageHint: 'Citește acest formular în limba ta',
    fullName: 'Nume complet',
    email: 'E-mail',
    phone: 'Telefon',
    bikeDetails: 'Detalii bicicletă',
    describeProblem: 'Descrie problema',
    describeProblemPlaceholder: 'ex. Frâna spate este moale sau am nevoie de ea până vineri',
    preferredDate: 'Data preferată',
    preferredTime: 'Ora preferată',
    serviceType: 'Tip de serviciu',
    dropOff: 'Predare la atelier',
    homeVisit: 'Vizită la domiciliu / deplasare',
    address: 'Adresă',
    additionalDetails: 'Detalii suplimentare',
    additionalDetailsHint: 'Orice altceva ar trebui să știe mecanicul',
    accessNotes: 'Note de acces / predare',
    accessNotesPlaceholder: 'ex. Cod poartă 1234, lasă la recepție',
    extraDetail: 'Detaliu suplimentar',
    extraDetailPlaceholder: 'ex. O folosesc doar în weekend, ultimul service acum 8 luni',
    preferredContact: 'Contact preferat',
    contactCall: 'Apel telefonic',
    contactEmail: 'E-mail',
    submitBooking: 'Trimite programarea',
    submitting: 'Se trimite…',
    requiredNote: 'Câmpurile marcate cu * sunt obligatorii',
    translatingNote: 'Notele tale vor fi traduse pentru atelier.',
  },
  lt: {
    formHeading: 'Užsisakyti dirbtuvių aptarnavimą',
    languageLabel: 'Kalba',
    languageHint: 'Skaitykite šią formą savo kalba',
    fullName: 'Vardas ir pavardė',
    email: 'El. paštas',
    phone: 'Telefonas',
    bikeDetails: 'Dviračio duomenys',
    describeProblem: 'Aprašykite problemą',
    describeProblemPlaceholder: 'pvz. Galinis stabdys minkštas arba reikia iki penktadienio',
    preferredDate: 'Pageidaujama data',
    preferredTime: 'Pageidaujamas laikas',
    serviceType: 'Paslaugos tipas',
    dropOff: 'Pristatymas į dirbtuves',
    homeVisit: 'Vizitas namuose / išvykimas',
    address: 'Adresas',
    additionalDetails: 'Papildoma informacija',
    additionalDetailsHint: 'Viskas, ką mechanikas turėtų žinoti',
    accessNotes: 'Prieigos / pristatymo pastabos',
    accessNotesPlaceholder: 'pvz. Vartų kodas 1234, palikite recepcijoje',
    extraDetail: 'Papildoma detalė',
    extraDetailPlaceholder: 'pvz. Važinėju tik savaitgaliais, paskutinis aptarnavimas prieš 8 mėn.',
    preferredContact: 'Pageidaujamas kontaktas',
    contactCall: 'Skambutis',
    contactEmail: 'El. paštas',
    submitBooking: 'Pateikti užsakymą',
    submitting: 'Pateikiama…',
    requiredNote: 'Laukai su * yra privalomi',
    translatingNote: 'Jūsų pastabos bus išverstos dirbtuvėms.',
  },
  bg: {
    formHeading: 'Запази услуга в сервиза',
    languageLabel: 'Език',
    languageHint: 'Прочети този формуляр на своя език',
    fullName: 'Име и фамилия',
    email: 'Имейл',
    phone: 'Телефон',
    bikeDetails: 'Данни за колелото',
    describeProblem: 'Опиши проблема',
    describeProblemPlaceholder: 'напр. Задната спирачка е мека или ми трябва до петък',
    preferredDate: 'Желана дата',
    preferredTime: 'Желано време',
    serviceType: 'Вид услуга',
    dropOff: 'Доставяне в сервиза',
    homeVisit: 'Посещение на адрес / повикване',
    address: 'Адрес',
    additionalDetails: 'Допълнителни подробности',
    additionalDetailsHint: 'Всичко, което механикът трябва да знае',
    accessNotes: 'Бележки за достъп / доставяне',
    accessNotesPlaceholder: 'напр. Код на порта 1234, оставете на рецепцията',
    extraDetail: 'Допълнителна подробност',
    extraDetailPlaceholder: 'напр. Карам го само през уикенда, последен сервиз преди 8 месеца',
    preferredContact: 'Предпочитан контакт',
    contactCall: 'Телефонно обаждане',
    contactEmail: 'Имейл',
    submitBooking: 'Изпрати заявка',
    submitting: 'Изпращане…',
    requiredNote: 'Полетата с * са задължителни',
    translatingNote: 'Бележките ти ще бъдат преведени за сервиза.',
  },
  pt: {
    formHeading: 'Marcar um serviço na oficina',
    languageLabel: 'Idioma',
    languageHint: 'Leia este formulário no seu idioma',
    fullName: 'Nome completo',
    email: 'E-mail',
    phone: 'Telefone',
    bikeDetails: 'Detalhes da bicicleta',
    describeProblem: 'Descreva o problema',
    describeProblemPlaceholder: 'ex. O travão de trás está esponjoso ou preciso dela até sexta',
    preferredDate: 'Data preferida',
    preferredTime: 'Hora preferida',
    serviceType: 'Tipo de serviço',
    dropOff: 'Entrega na oficina',
    homeVisit: 'Visita ao domicílio / deslocação',
    address: 'Morada',
    additionalDetails: 'Detalhes adicionais',
    additionalDetailsHint: 'Qualquer coisa que o mecânico deva saber',
    accessNotes: 'Notas de acesso / entrega',
    accessNotesPlaceholder: 'ex. Código do portão 1234, deixar na receção',
    extraDetail: 'Detalhe extra',
    extraDetailPlaceholder: 'ex. Só ando aos fins de semana, última revisão há 8 meses',
    preferredContact: 'Contacto preferido',
    contactCall: 'Chamada telefónica',
    contactEmail: 'E-mail',
    submitBooking: 'Enviar marcação',
    submitting: 'A enviar…',
    requiredNote: 'Os campos com * são obrigatórios',
    translatingNote: 'As suas notas serão traduzidas para a oficina.',
  },
  pa: {
    formHeading: 'ਵਰਕਸ਼ਾਪ ਸੇਵਾ ਬੁੱਕ ਕਰੋ',
    languageLabel: 'ਭਾਸ਼ਾ',
    languageHint: 'ਇਹ ਫਾਰਮ ਆਪਣੀ ਭਾਸ਼ਾ ਵਿੱਚ ਪੜ੍ਹੋ',
    fullName: 'ਪੂਰਾ ਨਾਮ',
    email: 'ਈਮੇਲ',
    phone: 'ਫ਼ੋਨ',
    bikeDetails: 'ਬਾਈਕ ਦੀ ਜਾਣਕਾਰੀ',
    describeProblem: 'ਸਮੱਸਿਆ ਦੱਸੋ',
    describeProblemPlaceholder: 'ਜਿਵੇਂ ਪਿਛਲਾ ਬ੍ਰੇਕ ਨਰਮ ਲੱਗਦਾ ਹੈ ਜਾਂ ਸ਼ੁੱਕਰਵਾਰ ਤੱਕ ਚਾਹੀਦੀ ਹੈ',
    preferredDate: 'ਪਸੰਦੀਦਾ ਤਾਰੀਖ਼',
    preferredTime: 'ਪਸੰਦੀਦਾ ਸਮਾਂ',
    serviceType: 'ਸੇਵਾ ਦੀ ਕਿਸਮ',
    dropOff: 'ਵਰਕਸ਼ਾਪ ਵਿੱਚ ਛੱਡੋ',
    homeVisit: 'ਘਰ ਮੁਲਾਕਾਤ / ਕਾਲ-ਆਊਟ',
    address: 'ਪਤਾ',
    additionalDetails: 'ਵਾਧੂ ਜਾਣਕਾਰੀ',
    additionalDetailsHint: 'ਕੋਈ ਵੀ ਚੀਜ਼ ਜੋ ਮਕੈਨਿਕ ਨੂੰ ਪਤਾ ਹੋਣੀ ਚਾਹੀਦੀ ਹੈ',
    accessNotes: 'ਪਹੁੰਚ / ਛੱਡਣ ਦੇ ਨੋਟ',
    accessNotesPlaceholder: 'ਜਿਵੇਂ ਗੇਟ ਕੋਡ 1234, ਰਿਸੈਪਸ਼ਨ ਤੇ ਛੱਡੋ',
    extraDetail: 'ਵਾਧੂ ਵੇਰਵਾ',
    extraDetailPlaceholder: 'ਜਿਵੇਂ ਮੈਂ ਸਿਰਫ਼ ਵੀਕੈਂਡ ਤੇ ਚਲਾਉਂਦਾ ਹਾਂ, ਪਿਛਲੀ ਸੇਵਾ 8 ਮਹੀਨੇ ਪਹਿਲਾਂ',
    preferredContact: 'ਪਸੰਦੀਦਾ ਸੰਪਰਕ',
    contactCall: 'ਫ਼ੋਨ ਕਾਲ',
    contactEmail: 'ਈਮੇਲ',
    submitBooking: 'ਬੁਕਿੰਗ ਭੇਜੋ',
    submitting: 'ਭੇਜ ਰਿਹਾ ਹੈ…',
    requiredNote: '* ਵਾਲੇ ਖਾਨੇ ਲਾਜ਼ਮੀ ਹਨ',
    translatingNote: 'ਤੁਹਾਡੇ ਨੋਟ ਵਰਕਸ਼ਾਪ ਲਈ ਅਨੁਵਾਦ ਕੀਤੇ ਜਾਣਗੇ।',
  },
  ur: {
    formHeading: 'ورکشاپ سروس بک کریں',
    languageLabel: 'زبان',
    languageHint: 'یہ فارم اپنی زبان میں پڑھیں',
    fullName: 'پورا نام',
    email: 'ای میل',
    phone: 'فون',
    bikeDetails: 'بائیک کی تفصیلات',
    describeProblem: 'مسئلہ بیان کریں',
    describeProblemPlaceholder: 'مثلاً پچھلا بریک نرم لگتا ہے یا جمعہ سے پہلے چاہیے',
    preferredDate: 'پسندیدہ تاریخ',
    preferredTime: 'پسندیدہ وقت',
    serviceType: 'سروس کی قسم',
    dropOff: 'ورکشاپ میں چھوڑ دیں',
    homeVisit: 'گھر پر وزٹ / کال آؤٹ',
    address: 'پتہ',
    additionalDetails: 'اضافی تفصیلات',
    additionalDetailsHint: 'کوئی بھی بات جو مکینک کو معلوم ہونی چاہیے',
    accessNotes: 'رسائی / چھوڑنے کے نوٹس',
    accessNotesPlaceholder: 'مثلاً گیٹ کوڈ 1234، ریسپشن پر چھوڑ دیں',
    extraDetail: 'اضافی تفصیل',
    extraDetailPlaceholder: 'مثلاً میں صرف ویک اینڈ پر چلاتا ہوں، پچھلی سروس 8 ماہ پہلے',
    preferredContact: 'ترجیحی رابطہ',
    contactCall: 'فون کال',
    contactEmail: 'ای میل',
    submitBooking: 'بکنگ بھیجیں',
    submitting: 'بھیجا جا رہا ہے…',
    requiredNote: '* والے خانے لازمی ہیں',
    translatingNote: 'آپ کے نوٹس ورکشاپ کے لیے ترجمہ کیے جائیں گے۔',
  },
  ar: {
    formHeading: 'احجز خدمة ورشة',
    languageLabel: 'اللغة',
    languageHint: 'اقرأ هذا النموذج بلغتك',
    fullName: 'الاسم الكامل',
    email: 'البريد الإلكتروني',
    phone: 'الهاتف',
    bikeDetails: 'تفاصيل الدراجة',
    describeProblem: 'صف المشكلة',
    describeProblemPlaceholder: 'مثال: الفرامل الخلفية ضعيفة أو أحتاجها قبل الجمعة',
    preferredDate: 'التاريخ المفضل',
    preferredTime: 'الوقت المفضل',
    serviceType: 'نوع الخدمة',
    dropOff: 'تسليم في الورشة',
    homeVisit: 'زيارة منزلية / استدعاء',
    address: 'العنوان',
    additionalDetails: 'تفاصيل إضافية',
    additionalDetailsHint: 'أي شيء آخر يجب أن يعرفه الميكانيكي',
    accessNotes: 'ملاحظات الوصول / التسليم',
    accessNotesPlaceholder: 'مثال: رمز البوابة 1234، اتركها في الاستقبال',
    extraDetail: 'تفصيل إضافي',
    extraDetailPlaceholder: 'مثال: أستخدمها في عطلة الأسبوع فقط، آخر صيانة قبل 8 أشهر',
    preferredContact: 'طريقة التواصل المفضلة',
    contactCall: 'مكالمة هاتفية',
    contactEmail: 'البريد الإلكتروني',
    submitBooking: 'إرسال الحجز',
    submitting: 'جارٍ الإرسال…',
    requiredNote: 'الحقول المعلّمة بـ * مطلوبة',
    translatingNote: 'سيتم ترجمة ملاحظاتك من أجل الورشة.',
  },
  uk: {
    formHeading: 'Замовити обслуговування у майстерні',
    languageLabel: 'Мова',
    languageHint: 'Читайте цю форму своєю мовою',
    fullName: 'Ім’я та прізвище',
    email: 'Ел. пошта',
    phone: 'Телефон',
    bikeDetails: 'Дані велосипеда',
    describeProblem: 'Опишіть проблему',
    describeProblemPlaceholder: 'напр. Задній гальмо м’яке або потрібно до п’ятниці',
    preferredDate: 'Бажана дата',
    preferredTime: 'Бажаний час',
    serviceType: 'Тип послуги',
    dropOff: 'Доставка в майстерню',
    homeVisit: 'Візит додому / виїзд',
    address: 'Адреса',
    additionalDetails: 'Додаткові відомості',
    additionalDetailsHint: 'Усе, що механік має знати',
    accessNotes: 'Нотатки про доступ / доставку',
    accessNotesPlaceholder: 'напр. Код воріт 1234, залиште на ресепшн',
    extraDetail: 'Додаткова деталь',
    extraDetailPlaceholder: 'напр. Їжджу лише на вихідних, останнє ТО 8 місяців тому',
    preferredContact: 'Бажаний контакт',
    contactCall: 'Телефонний дзвінок',
    contactEmail: 'Ел. пошта',
    submitBooking: 'Надіслати заявку',
    submitting: 'Надсилання…',
    requiredNote: 'Поля з * обов’язкові',
    translatingNote: 'Ваші нотатки буде перекладено для майстерні.',
  },
  ru: {
    formHeading: 'Записаться на обслуживание в мастерской',
    languageLabel: 'Язык',
    languageHint: 'Прочитайте эту форму на своём языке',
    fullName: 'Имя и фамилия',
    email: 'Эл. почта',
    phone: 'Телефон',
    bikeDetails: 'Данные велосипеда',
    describeProblem: 'Опишите проблему',
    describeProblemPlaceholder: 'напр. Задний тормоз мягкий или нужно до пятницы',
    preferredDate: 'Желаемая дата',
    preferredTime: 'Желаемое время',
    serviceType: 'Тип услуги',
    dropOff: 'Доставка в мастерскую',
    homeVisit: 'Визит на дом / выезд',
    address: 'Адрес',
    additionalDetails: 'Дополнительные сведения',
    additionalDetailsHint: 'Всё, что должен знать механик',
    accessNotes: 'Заметки о доступе / доставке',
    accessNotesPlaceholder: 'напр. Код калитки 1234, оставьте на ресепшене',
    extraDetail: 'Дополнительная деталь',
    extraDetailPlaceholder: 'напр. Катаюсь только по выходным, последнее ТО 8 месяцев назад',
    preferredContact: 'Предпочитаемый контакт',
    contactCall: 'Звонок',
    contactEmail: 'Эл. почта',
    submitBooking: 'Отправить заявку',
    submitting: 'Отправка…',
    requiredNote: 'Поля со * обязательны',
    translatingNote: 'Ваши заметки будут переведены для мастерской.',
  },
  tr: {
    formHeading: 'Atölye servisi randevusu al',
    languageLabel: 'Dil',
    languageHint: 'Bu formu kendi dilinizde okuyun',
    fullName: 'Ad soyad',
    email: 'E-posta',
    phone: 'Telefon',
    bikeDetails: 'Bisiklet bilgileri',
    describeProblem: 'Sorunu açıklayın',
    describeProblemPlaceholder: 'örn. Arka fren yumuşak ya da cumaya kadar lazım',
    preferredDate: 'Tercih edilen tarih',
    preferredTime: 'Tercih edilen saat',
    serviceType: 'Servis türü',
    dropOff: 'Atölyeye bırakma',
    homeVisit: 'Eve ziyaret / çağrı',
    address: 'Adres',
    additionalDetails: 'Ek bilgiler',
    additionalDetailsHint: 'Tamircinin bilmesi gereken her şey',
    accessNotes: 'Erişim / bırakma notları',
    accessNotesPlaceholder: 'örn. Kapı kodu 1234, resepsiyona bırakın',
    extraDetail: 'Ek ayrıntı',
    extraDetailPlaceholder: 'örn. Sadece hafta sonları biniyorum, son bakım 8 ay önce',
    preferredContact: 'Tercih edilen iletişim',
    contactCall: 'Telefon araması',
    contactEmail: 'E-posta',
    submitBooking: 'Randevuyu gönder',
    submitting: 'Gönderiliyor…',
    requiredNote: '* işaretli alanlar zorunludur',
    translatingNote: 'Notlarınız atölye için çevrilecektir.',
  },
  sq: {
    formHeading: 'Rezervo një shërbim në punishte',
    languageLabel: 'Gjuha',
    languageHint: 'Lexoni këtë formular në gjuhën tuaj',
    fullName: 'Emri i plotë',
    email: 'Email',
    phone: 'Telefon',
    bikeDetails: 'Detajet e biçikletës',
    describeProblem: 'Përshkruani problemin',
    describeProblemPlaceholder: 'p.sh. Freni i pasëm është i butë ose më duhet para të premtes',
    preferredDate: 'Data e preferuar',
    preferredTime: 'Ora e preferuar',
    serviceType: 'Lloji i shërbimit',
    dropOff: 'Dorëzim në punishte',
    homeVisit: 'Vizitë në shtëpi / thirrje',
    address: 'Adresa',
    additionalDetails: 'Detaje shtesë',
    additionalDetailsHint: 'Çdo gjë që mekaniku duhet të dijë',
    accessNotes: 'Shënime aksesi / dorëzimi',
    accessNotesPlaceholder: 'p.sh. Kodi i portës 1234, lëreni në recepsion',
    extraDetail: 'Detaj shtesë',
    extraDetailPlaceholder: 'p.sh. E ngas vetëm në fundjavë, shërbimi i fundit 8 muaj më parë',
    preferredContact: 'Kontakti i preferuar',
    contactCall: 'Telefonatë',
    contactEmail: 'Email',
    submitBooking: 'Dërgo rezervimin',
    submitting: 'Po dërgohet…',
    requiredNote: 'Fushat me * janë të detyrueshme',
    translatingNote: 'Shënimet tuaja do të përkthehen për punishten.',
  },
  es: {
    formHeading: 'Reservar un servicio en el taller',
    languageLabel: 'Idioma',
    languageHint: 'Lee este formulario en tu idioma',
    fullName: 'Nombre completo',
    email: 'Correo electrónico',
    phone: 'Teléfono',
    bikeDetails: 'Datos de la bicicleta',
    describeProblem: 'Describe el problema',
    describeProblemPlaceholder: 'p. ej. El freno trasero está blando o lo necesito antes del viernes',
    preferredDate: 'Fecha preferida',
    preferredTime: 'Hora preferida',
    serviceType: 'Tipo de servicio',
    dropOff: 'Entrega en el taller',
    homeVisit: 'Visita a domicilio / desplazamiento',
    address: 'Dirección',
    additionalDetails: 'Detalles adicionales',
    additionalDetailsHint: 'Cualquier cosa que el mecánico deba saber',
    accessNotes: 'Notas de acceso / entrega',
    accessNotesPlaceholder: 'p. ej. Código de portal 1234, dejar en recepción',
    extraDetail: 'Detalle adicional',
    extraDetailPlaceholder: 'p. ej. Solo la uso los fines de semana, última revisión hace 8 meses',
    preferredContact: 'Contacto preferido',
    contactCall: 'Llamada telefónica',
    contactEmail: 'Correo electrónico',
    submitBooking: 'Enviar reserva',
    submitting: 'Enviando…',
    requiredNote: 'Los campos con * son obligatorios',
    translatingNote: 'Tus notas se traducirán para el taller.',
  },
};

export function getPhrases(code: LanguageCode): BookingPhrases {
  return BOOKING_PHRASES[code] || BOOKING_PHRASES.en;
}
