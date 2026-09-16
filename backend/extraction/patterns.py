import re

# MRP & Price patterns
MRP_PATTERN = re.compile(
    r"(?:M\.?R\.?P\.?|MAX(?:IMUM)?\s*RETAIL\s*PRICE|PRICE|MRP)"
    r"[^\d₹Rs\n]*"
    r"(?:₹|Rs\.?|INR)?\s*"
    r"(\d+(?:\.\d{1,2})?)"
    r"(?:\s*/-|\s*INR)?",
    re.IGNORECASE,
)

STANDALONE_PRICE_PATTERN = re.compile(
    r"(?:₹|Rs\.?)\s*(\d+(?:\.\d{1,2})?)(?:\s*/-)?",
    re.IGNORECASE,
)

TAX_INCLUSIVE_PATTERN = re.compile(
    r"(?:INCL\.?|INCLUSIVE)\s*(?:OF)?\s*ALL\s*TAXES",
    re.IGNORECASE,
)

# Net Quantity patterns
NET_QTY_PATTERN = re.compile(
    r"(?:NET\s*(?:WT\.?|WEIGHT|QTY\.?|QUANTITY|VOL\.?|VOLUME|CONTENT|MASS)|QUANTITY|WEIGHT)"
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
    r"\b(1800[\s-]*\d{2,4}[\s-]*\d{3,4}|\+91[\s-]*\d{10}|\b\d{3,4}[\s-]*\d{6,8}\b)",
    re.IGNORECASE,
)

CARE_KEYWORD_PATTERN = re.compile(
    r"(?:CONSUMER\s*(?:CARE|CELL|FEEDBACK|GRIEVANCE|COMPLAINTS)|CUSTOMER\s*(?:CARE|SERVICE|SUPPORT)|FOR\s*COMPLAINTS)",
    re.IGNORECASE,
)

# Manufacturer & Address patterns
PIN_CODE_PATTERN = re.compile(r"\b([1-9]\d{2}\s?\d{3})\b")

# Crucial: Must match MANUFACTURED BY, MFD BY, etc., strictly requiring BY or FOR
MFG_NAME_PATTERN = re.compile(
    r"(?:(?:M(?:FD|FG|ANUFACTUR(?:ED|ING))|M(?:KTD|ARKETED))\s*(?:&|AND)?\s*(?:P(?:KD|ACKED))?)\s*(?:BY|FOR)[:\s-]*([^\n\r,]+)",
    re.IGNORECASE,
)

PACKED_BY_PATTERN = re.compile(
    r"(?:P(?:KD|ACKED|ACKAGING))\s*(?:BY|FOR)[:\s-]*([^\n\r,]+)",
    re.IGNORECASE,
)

IMPORTED_BY_PATTERN = re.compile(
    r"(?:IMP(?:ORTED)?)\s*(?:BY|FOR)[:\s-]*([^\n\r,]+)",
    re.IGNORECASE,
)

COUNTRY_OF_ORIGIN_PATTERN = re.compile(
    r"(?:COUNTRY\s*OF\s*ORIGIN|MADE\s*IN|PRODUCT\s*OF)[:\s-]*([a-zA-Z\s]+)",
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
