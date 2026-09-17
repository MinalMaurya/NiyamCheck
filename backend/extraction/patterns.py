import re

# Nutrition keywords to strictly exclude from Net Quantity and MRP extractions
NUTRITION_EXCLUSIONS = [
    "FAT", "SATURATED", "TRANS", "CHOLESTEROL", "SODIUM", "SALT",
    "CARBOHYDRATE", "FIBER", "FIBRE", "SUGAR", "SUGARS", "PROTEIN",
    "CALORIE", "CALORIES", "ENERGY", "KCAL", "KJ", "SERVING", "SERVINGS",
    "DAILY VALUE", "% DV", "%DV", "NUTRITION", "NUTRIENT", "VITAMIN",
    "CALCIUM", "IRON", "POTASSIUM", "DIETARY", "ADDED SUGARS",
]

# Non-product-name phrases (freshness claims, marketing slogans, handling instructions, allergens)
PRODUCT_NAME_EXCLUSIONS = [
    # Declaration headers & keywords
    "MRP", "NET WT", "NET WEIGHT", "NET QTY", "NET QUANTITY", "NET VOL", "NET CONTENT",
    "MFD", "MFG", "PKD", "PACKED", "PKG", "PKGD", "PACKING", "EXP", "USE BY", "BEST BEFORE", "BATCH", "LOT NO",
    "INGREDIENTS", "CALL", "EMAIL", "MADE IN", "COUNTRY OF ORIGIN", "PRODUCT OF", "PRODUCED IN", "PACKED BY", "MANUFACTURED", "IMPORTED BY", "MARKETED BY",
    "CONSUMER", "CUSTOMER", "PRICE", "RS.", "₹", "INR", "BARCODE",
    "TAXES", "TAX", "INCL", "INCLUSIVE", "RETAIL PRICE", "MAXIMUM RETAIL",
    # Freshness / Quality / Slogans
    "GUARANTEED FRESH", "FRESHNESS", "GUARANTEE", "100% FRESH", "BEST QUALITY", "PREMIUM QUALITY",
    "UNTIL PRINTED DATE", "SATISFACTION GUARANTEED", "CRISPY & FRESH", "QUALITY GUARANTEE",
    "MONEY BACK", "GREAT TASTE", "ORIGINAL TASTE",
    # Nutrition / Free claims
    "NUTRITION", "NUTRIENT", "SERVING", "CALORIES", "TOTAL FAT", "SATURATED", "TRANS FAT",
    "CHOLESTEROL", "SODIUM", "CARBOHYDRATE", "PROTEIN", "DIETARY FIBER", "TOTAL SUGARS",
    "ADDED SUGARS", "GLUTEN FREE", "NO ARTIFICIAL", "NO PRESERVATIVES", "NON GMO", "ORGANIC",
    # Storage / Handling / Recycling
    "KEEP COOL", "STORE IN", "STORE AWAY", "DRY PLACE", "KEEP AWAY", "RECYCLE", "DISPOSE",
    "TRASH", "GREEN DOT", "SERVING SUGGESTION", "FOR ILLUSTRATION", "CREATIVE VISUALIZATION",
    # Contact / Portal
    "QUESTIONS OR COMMENTS", "FEEDBACK", "CONTACT US", "HELPLINE", "TOLL FREE", "VISIT US",
    "WWW.", "HTTP", ".COM",
]

# MRP & Price patterns
MRP_PATTERN = re.compile(
    r"\b(?:M\.?I?\.?R\.?P\.?|M\.?R\.?P\.?|M\s*R\s*P|MAX(?:IMUM)?\s*RETAIL\s*PRICE|RETAIL\s*PRICE|MRP|PRICE)\b"
    r"[:\s.-]*"
    r"[^\d₹Rs\$\n]*"
    r"(?:(?:\bRs\.?|\bR\$|\bINR|₹|\$)\s*)?"
    r"(\d+(?:\.\d{1,2})?)"
    r"(?!\s*(?:g|gm|kg|ml|l|ltr|mg|oz|cal|kcal|serving|piece|pack|%))\b"
    r"(?:\s*/-|\s*INR)?",
    re.IGNORECASE,
)

STANDALONE_PRICE_PATTERN = re.compile(
    r"(?:(?<=\s)|^|(?<=[^a-zA-Z]))(?:₹|\$|\bRs\.?|\bR\$|\bINR)\s*(\d+(?:\.\d{1,2})?)"
    r"(?!\s*(?:g|gm|kg|ml|l|ltr|mg|oz|cal|kcal|serving|piece|pack|%))\b"
    r"(?:\s*/-)?",
    re.IGNORECASE,
)

TAX_INCLUSIVE_PATTERN = re.compile(
    r"(?:INCL\.?|INCLUSIVE)\s*(?:OF)?\s*ALL\s*TAXES",
    re.IGNORECASE,
)

# Net Quantity patterns
NET_QTY_PATTERN = re.compile(
    r"\b(?:NET\s*(?:WT\.?|WEIGHT|QTY\.?|QUANTITY|VOL\.?|VOLUME|CONTENT|MASS)|NETTO)\b"
    r"[^\d\n]*"
    r"(\d+(?:\.\d+)?)\s*"
    r"(kg|g|gm|grams?|ml|millilitres?|l|ltr|litres?|m|metres?|cm|mm|units?|pieces?|pcs|N)\b",
    re.IGNORECASE,
)

MULTI_PACK_PATTERN = re.compile(
    r"(\d+)\s*(?:x|X)\s*(\d+(?:\.\d+)?)\s*(kg|g|gm|ml|l|ltr|units?|N)\b",
    re.IGNORECASE,
)

STANDALONE_QTY_PATTERN = re.compile(
    r"\b(\d+(?:\.\d+)?)\s*(kg|g|gm|ml|l|ltr|litres?|m|metres?|units?|N)\b",
    re.IGNORECASE,
)

# Date Information patterns (MFD, MFG, PKD, PACKED, USE BY, BEST BEFORE)
DATE_PREFIX_PATTERN = re.compile(
    r"(?:M(?:FD|FG)\.?|DATE\s*OF\s*M(?:FG|ANUFACTURING)|P(?:KD|ACKED)\.?|DATE\s*OF\s*PACK(?:ING)?|IMP(?:ORTED)?\.?)"
    r"[^\d\n]*"
    r"(?:(\d{1,2})[\/\.-])?"
    r"(\d{1,2}|[a-zA-Z]{3,9})[\/\.-]"
    r"(\d{2,4})\b",
    re.IGNORECASE,
)

EXPIRY_PATTERN = re.compile(
    r"(?:BEST\s*BEFORE|USE\s*BY|EXP(?:IRY)?\.?|EXP\s*DATE)"
    r"[^\d\n]*"
    r"([^\n\r]+)",
    re.IGNORECASE,
)

STANDALONE_DATE_PATTERN = re.compile(
    r"\b(?:(\d{1,2})[\/\.-])?(\d{1,2}|[a-zA-Z]{3,9})[\/\.-](20\d{2}|\d{2})\b",
    re.IGNORECASE,
)

# Consumer Care patterns
EMAIL_PATTERN = re.compile(
    r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+",
    re.IGNORECASE,
)

PHONE_PATTERN = re.compile(
    r"(?:(?:CALL|TEL|PH|PHONE|TOLL[\s-]*FREE|HELPLINE|NO\.?)[^\d\n]*)?"
    r"\b("
    r"1[-.\s]*800[-.\s]*\d{3}[-.\s]*\d{4}"
    r"|1800[-.\s]*\d{2,4}[-.\s]*\d{3,4}"
    r"|\+?91[-.\s]*\d{5}[-.\s]*\d{5}"
    r"|\+?91[-.\s]*\d{10}"
    r"|\b0\d{2,4}[-.\s]*\d{6,8}\b"
    r"|\b\d{3,4}[-.\s]*\d{6,8}\b"
    r")",
    re.IGNORECASE,
)

WEBSITE_PATTERN = re.compile(
    r"\b(?:https?:\/\/|www\.)[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+(?:\/[^\s,;]*)?|\b[a-zA-Z0-9-]+\.(?:com|in|org|net|co\.in|co|gov\.in)\b",
    re.IGNORECASE,
)

CARE_KEYWORD_PATTERN = re.compile(
    r"(?:CONSUMER\s*(?:CARE|CELL|FEEDBACK|GRIEVANCE|COMPLAINTS|SUPPORT)|"
    r"CUSTOMER\s*(?:CARE|SERVICE|SUPPORT|FEEDBACK|HELPLINE)|"
    r"FOR\s*(?:COMPLAINTS|QUERIES|FEEDBACK|SUGGESTIONS)|"
    r"QUESTIONS\s*(?:OR|\/)?\s*COMMENTS|"
    r"FEEDBACK\s*(?:OR|\/)?\s*QUERIES|"
    r"CONTACT\s*US|TALK\s*TO\s*US|REACH\s*US\s*AT|HELPLINE)",
    re.IGNORECASE,
)

# Manufacturer & Address patterns
PIN_CODE_PATTERN = re.compile(r"\b([1-9]\d{2}\s?\d{3})\b")
US_ZIP_PATTERN = re.compile(r"\b(\d{5}(?:-\d{4})?)\b")

MFG_NAME_PATTERN = re.compile(
    r"(?:(?:M(?:FD|FG|ANUFACTUR(?:ED|ING))|M(?:KTD|ARKETED))\s*(?:&|AND)?\s*(?:P(?:KD|ACKED))?)\s*(?:BY|FOR)[:\s-]*([^\n\r]+)",
    re.IGNORECASE,
)

PACKED_BY_PATTERN = re.compile(
    r"(?:P(?:KD|ACKED|ACKAGING))\s*(?:BY|FOR)[:\s-]*([^\n\r]+)",
    re.IGNORECASE,
)

IMPORTED_BY_PATTERN = re.compile(
    r"(?:IMP(?:ORTED)?)\s*(?:BY|FOR)[:\s-]*([^\n\r]+)",
    re.IGNORECASE,
)

COUNTRY_OF_ORIGIN_PATTERN = re.compile(
    r"(?:COUNTRY\s*OF\s*ORIGIN|MADE\s*IN|PRODUCT\s*OF)[:\s-]*([a-zA-Z]+(?:[ \t]+[a-zA-Z]+)?)",
    re.IGNORECASE,
)

INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Delhi", "Chandigarh", "Puducherry"
]

ADDRESS_KEYWORDS = [
    "ROAD", "RD.", "STREET", "ST.", "LANE", "AVENUE", "AVE.", "BLVD", "BOULEVARD",
    "SECTOR", "PLOT", "PHASE", "INDUSTRIAL", "AREA", "MIDC", "GIDC", "RIICO",
    "NAGAR", "MARG", "COLONY", "ENCLAVE", "ESTATE", "PARK", "TOWER", "BUILDING",
    "PO BOX", "P.O. BOX", "P.O.B.", "BOX NO", "DIST.", "DISTRICT", "TEHSIL", "TALUKA",
    "VILLAGE", "POST", "USA", "U.S.A.", "UNITED STATES", "INDIA", "UK",
]
