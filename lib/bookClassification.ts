// Structured book classification. Two systems are offered:
//  - "genre"  — a practical two-level genre taxonomy for a home library
//  - "dewey"  — the Dewey Decimal System (10 classes × 10 divisions)
//  - "custom" — free text fallback (also preserves any legacy value)
//
// The chosen value is stored across three item attributes:
//   classification_system : 'genre' | 'dewey' | 'custom'
//   classification        : human-readable label (shown on cards)
//   classification_code    : Dewey number when applicable (for sorting/shelving)

export type ClassificationSystem = "genre" | "dewey" | "custom";

// ---- Genre taxonomy --------------------------------------------------------
export const GENRE_TAXONOMY: { group: string; items: string[] }[] = [
  {
    group: "Fiction",
    items: [
      "Literary Fiction",
      "Science Fiction",
      "Fantasy",
      "Mystery & Crime",
      "Thriller & Suspense",
      "Horror",
      "Romance",
      "Historical Fiction",
      "Adventure",
      "Young Adult",
      "Children's",
      "Graphic Novel & Comics",
      "Short Stories",
      "Poetry",
      "Classic",
    ],
  },
  {
    group: "Non-fiction",
    items: [
      "Biography & Memoir",
      "History",
      "Science & Nature",
      "Technology & Computing",
      "Business & Economics",
      "Self-Help",
      "Philosophy",
      "Religion & Spirituality",
      "Psychology",
      "Politics & Society",
      "Travel",
      "Cooking & Food",
      "Art & Photography",
      "Health & Fitness",
      "Reference",
      "Education",
      "True Crime",
      "Essays",
    ],
  },
];

// ---- Dewey Decimal (second summary: 10 classes, 100 divisions) -------------
export const DEWEY_CLASSES: {
  code: string;
  label: string;
  divisions: { code: string; label: string }[];
}[] = [
  {
    code: "000",
    label: "Computer science, information & general works",
    divisions: [
      { code: "000", label: "Computer science & knowledge" },
      { code: "010", label: "Bibliographies" },
      { code: "020", label: "Library & information sciences" },
      { code: "030", label: "Encyclopedias & books of facts" },
      { code: "050", label: "Magazines, journals & serials" },
      { code: "060", label: "Associations & organizations" },
      { code: "070", label: "News media, journalism & publishing" },
      { code: "080", label: "Quotations" },
      { code: "090", label: "Manuscripts & rare books" },
    ],
  },
  {
    code: "100",
    label: "Philosophy & psychology",
    divisions: [
      { code: "100", label: "Philosophy" },
      { code: "110", label: "Metaphysics" },
      { code: "120", label: "Epistemology" },
      { code: "130", label: "Parapsychology & occultism" },
      { code: "140", label: "Philosophical schools of thought" },
      { code: "150", label: "Psychology" },
      { code: "160", label: "Logic" },
      { code: "170", label: "Ethics" },
      { code: "180", label: "Ancient, medieval & eastern philosophy" },
      { code: "190", label: "Modern western philosophy" },
    ],
  },
  {
    code: "200",
    label: "Religion",
    divisions: [
      { code: "200", label: "Religion" },
      { code: "210", label: "Philosophy & theory of religion" },
      { code: "220", label: "The Bible" },
      { code: "230", label: "Christianity" },
      { code: "240", label: "Christian practice & observance" },
      { code: "250", label: "Christian orders & local church" },
      { code: "260", label: "Christian social & ecclesiastical theology" },
      { code: "270", label: "History of Christianity" },
      { code: "280", label: "Christian denominations" },
      { code: "290", label: "Other religions" },
    ],
  },
  {
    code: "300",
    label: "Social sciences",
    divisions: [
      { code: "300", label: "Social sciences, sociology & anthropology" },
      { code: "310", label: "Statistics" },
      { code: "320", label: "Political science" },
      { code: "330", label: "Economics" },
      { code: "340", label: "Law" },
      { code: "350", label: "Public administration & military science" },
      { code: "360", label: "Social problems & social services" },
      { code: "370", label: "Education" },
      { code: "380", label: "Commerce, communications & transport" },
      { code: "390", label: "Customs, etiquette & folklore" },
    ],
  },
  {
    code: "400",
    label: "Language",
    divisions: [
      { code: "400", label: "Language" },
      { code: "410", label: "Linguistics" },
      { code: "420", label: "English & Old English" },
      { code: "430", label: "German & related languages" },
      { code: "440", label: "French & related languages" },
      { code: "450", label: "Italian, Romanian & related" },
      { code: "460", label: "Spanish, Portuguese, Galician" },
      { code: "470", label: "Latin & Italic languages" },
      { code: "480", label: "Classical & modern Greek" },
      { code: "490", label: "Other languages" },
    ],
  },
  {
    code: "500",
    label: "Science",
    divisions: [
      { code: "500", label: "Science" },
      { code: "510", label: "Mathematics" },
      { code: "520", label: "Astronomy" },
      { code: "530", label: "Physics" },
      { code: "540", label: "Chemistry" },
      { code: "550", label: "Earth sciences & geology" },
      { code: "560", label: "Fossils & prehistoric life" },
      { code: "570", label: "Biology & life sciences" },
      { code: "580", label: "Plants (Botany)" },
      { code: "590", label: "Animals (Zoology)" },
    ],
  },
  {
    code: "600",
    label: "Technology",
    divisions: [
      { code: "600", label: "Technology" },
      { code: "610", label: "Medicine & health" },
      { code: "620", label: "Engineering" },
      { code: "630", label: "Agriculture" },
      { code: "640", label: "Home & family management" },
      { code: "650", label: "Management & public relations" },
      { code: "660", label: "Chemical engineering" },
      { code: "670", label: "Manufacturing" },
      { code: "680", label: "Manufacture for specific uses" },
      { code: "690", label: "Building & construction" },
    ],
  },
  {
    code: "700",
    label: "Arts & recreation",
    divisions: [
      { code: "700", label: "Arts" },
      { code: "710", label: "Landscaping & area planning" },
      { code: "720", label: "Architecture" },
      { code: "730", label: "Sculpture, ceramics & metalwork" },
      { code: "740", label: "Drawing & decorative arts" },
      { code: "750", label: "Painting" },
      { code: "760", label: "Graphic arts" },
      { code: "770", label: "Photography & computer art" },
      { code: "780", label: "Music" },
      { code: "790", label: "Sports, games & entertainment" },
    ],
  },
  {
    code: "800",
    label: "Literature",
    divisions: [
      { code: "800", label: "Literature, rhetoric & criticism" },
      { code: "810", label: "American literature in English" },
      { code: "820", label: "English & Old English literatures" },
      { code: "830", label: "German & related literatures" },
      { code: "840", label: "French & related literatures" },
      { code: "850", label: "Italian, Romanian & related" },
      { code: "860", label: "Spanish, Portuguese, Galician" },
      { code: "870", label: "Latin & Italic literatures" },
      { code: "880", label: "Classical & modern Greek" },
      { code: "890", label: "Other literatures" },
    ],
  },
  {
    code: "900",
    label: "History & geography",
    divisions: [
      { code: "900", label: "History" },
      { code: "910", label: "Geography & travel" },
      { code: "920", label: "Biography & genealogy" },
      { code: "930", label: "History of the ancient world" },
      { code: "940", label: "History of Europe" },
      { code: "950", label: "History of Asia" },
      { code: "960", label: "History of Africa" },
      { code: "970", label: "History of North America" },
      { code: "980", label: "History of South America" },
      { code: "990", label: "History of other areas" },
    ],
  },
];
