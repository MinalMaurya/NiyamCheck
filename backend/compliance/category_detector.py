import re
from enum import Enum
from typing import List, Optional, Tuple, Dict, Any
from pydantic import BaseModel, Field

from backend.schemas.analysis import ExtractedFields, ExtractionStatus


class ProductCategory(str, Enum):
    PACKAGED_FOOD = "Packaged Food"
    BEVERAGES = "Beverages"
    PERSONAL_CARE = "Personal Care & Cosmetics"
    HOUSEHOLD_CLEANING = "Household & Cleaning"
    OTHER_COMMODITY = "Other Packaged Commodity"


class CategoryDetectionResult(BaseModel):
    """Structured outcome of multi-signal product classification."""
    category: str = Field(..., description="Determined commodity category")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence of category determination")
    detected_signals: List[str] = Field(default_factory=list, description="Observed evidence signals supporting this classification")
    is_verifiable: bool = Field(True, description="Whether category confidence is sufficient for category-specific statutory rules")
    reason: str = Field(..., description="Transparent explanation of category selection")


class ProductCategoryDetector:
    """
    Generic multi-signal product category detector.
    Evaluates observable packaging text, nutrition tables, ingredient lists, and
    product identifiers across categories without hardcoded brand names or closed catalogs.
    """

    # Multi-signal token and regex patterns (generic terminology only)
    NUTRITION_SIGNALS = [
        re.compile(r"\b(?:nutrition|nutritional|nutrition\s*facts|nutritive\s*value)\b", re.IGNORECASE),
        re.compile(r"\b(?:energy|calories|kcal)\b", re.IGNORECASE),
        re.compile(r"\b(?:protein|total\s*fat|saturated\s*fat|carbohydrate|dietary\s*fiber|sugars?|sodium)\b", re.IGNORECASE),
        re.compile(r"\b(?:serving\s*size|servings\s*per\s*container|per\s*100\s*g|per\s*serve)\b", re.IGNORECASE),
    ]

    INGREDIENT_SIGNALS = [
        re.compile(r"\bingredients?\s*:", re.IGNORECASE),
        re.compile(r"\b(?:edible\s*vegetable\s*oil|refined\s*wheat\s*flour|flour|sugar|salt|spices|condiments)\b", re.IGNORECASE),
        re.compile(r"\b(?:permitted\s*flavor|preservatives?|acidity\s*regulator|antioxidant|emulsifier)\b", re.IGNORECASE),
    ]

    FOOD_COMMODITY_SIGNALS = [
        re.compile(r"\b(?:chips|crisps|potato\s*chips|wafers?|namkeen|bhujia|mixture|snack|snacks)\b", re.IGNORECASE),
        re.compile(r"\b(?:biscuit|biscuits|cookies?|crackers?|rusk|toast|cake|bakery|bread)\b", re.IGNORECASE),
        re.compile(r"\b(?:noodles?|pasta|macaroni|instant\s*noodles|vermicelli)\b", re.IGNORECASE),
        re.compile(r"\b(?:chocolate|confectionery|candy|toffee|sweets?|dessert)\b", re.IGNORECASE),
        re.compile(r"\b(?:atta|rice|wheat|maida|besan|dal|pulses?|cereals?|grains?|corn\s*flakes|oats)\b", re.IGNORECASE),
        re.compile(r"\b(?:spice|spices|masala|turmeric|chilli|coriander|pepper|salt)\b", re.IGNORECASE),
        re.compile(r"\b(?:pickle|chutney|sauce|ketchup|jam|spread|honey)\b", re.IGNORECASE),
        re.compile(r"\b(?:ready\s*to\s*eat|ready\s*to\s*cook|instant\s*mix)\b", re.IGNORECASE),
    ]

    BEVERAGE_SIGNALS = [
        re.compile(r"\b(?:beverage|beverages|drink|drinks|juice|fruit\s*juice|nectar)\b", re.IGNORECASE),
        re.compile(r"\b(?:tea|coffee|espresso|brew|green\s*tea|tea\s*bags?)\b", re.IGNORECASE),
        re.compile(r"\b(?:carbonated\s*water|soda|soft\s*drink|cola|fizzy|tonic)\b", re.IGNORECASE),
        re.compile(r"\b(?:packaged\s*drinking\s*water|mineral\s*water|spring\s*water)\b", re.IGNORECASE),
        re.compile(r"\b(?:syrup|concentrate|crush|energy\s*drink|sports\s*drink)\b", re.IGNORECASE),
        re.compile(r"\b(?:milk|dairy\s*drink|milkshake|flavored\s*milk|buttermilk|lassi)\b", re.IGNORECASE),
    ]

    PERSONAL_CARE_SIGNALS = [
        re.compile(r"\b(?:shampoo|conditioner|hair\s*oil|hair\s*wash|hair\s*cream|hair\s*color)\b", re.IGNORECASE),
        re.compile(r"\b(?:soap|bathing\s*bar|body\s*wash|shower\s*gel|hand\s*wash)\b", re.IGNORECASE),
        re.compile(r"\b(?:cream|cold\s*cream|moisturizer|body\s*lotion|face\s*wash|face\s*scrub)\b", re.IGNORECASE),
        re.compile(r"\b(?:toothpaste|toothpowder|mouthwash|dental\s*gel|toothbrush)\b", re.IGNORECASE),
        re.compile(r"\b(?:sunscreen|sunblock|spf\s*\d+|anti-aging|serum|skin\s*care)\b", re.IGNORECASE),
        re.compile(r"\b(?:perfume|eau\s*de\s*parfum|deodorant|body\s*spray|attar)\b", re.IGNORECASE),
        re.compile(r"\b(?:cosmetic|cosmetics|lipstick|lip\s*balm|mascara|eyeliner|foundation)\b", re.IGNORECASE),
        re.compile(r"\b(?:dermatologically\s*tested|for\s*external\s*use\s*only)\b", re.IGNORECASE),
    ]

    HOUSEHOLD_CLEANING_SIGNALS = [
        re.compile(r"\b(?:detergent|detergent\s*powder|detergent\s*bar|washing\s*powder)\b", re.IGNORECASE),
        re.compile(r"\b(?:dishwash|dishwashing|dish\s*wash\s*bar|dish\s*wash\s*liquid)\b", re.IGNORECASE),
        re.compile(r"\b(?:surface\s*cleaner|floor\s*cleaner|toilet\s*cleaner|glass\s*cleaner)\b", re.IGNORECASE),
        re.compile(r"\b(?:disinfectant|bleach|stain\s*remover|fabric\s*conditioner)\b", re.IGNORECASE),
        re.compile(r"\b(?:insecticide|mosquito\s*repellent|air\s*freshener)\b", re.IGNORECASE),
    ]

    def detect(
        self,
        fields: Optional[ExtractedFields] = None,
        combined_text: str = "",
    ) -> CategoryDetectionResult:
        """
        Classifies product category based on extracted fields and full OCR text.
        Returns CategoryDetectionResult with confidence and transparent rationale.
        """
        text_corpus = (combined_text or "").strip()
        if fields and fields.product_name and fields.product_name.value:
            text_corpus = f"{fields.product_name.value} \n {text_corpus}"

        scores: Dict[str, float] = {
            ProductCategory.PACKAGED_FOOD.value: 0.0,
            ProductCategory.BEVERAGES.value: 0.0,
            ProductCategory.PERSONAL_CARE.value: 0.0,
            ProductCategory.HOUSEHOLD_CLEANING.value: 0.0,
            ProductCategory.OTHER_COMMODITY.value: 0.0,
        }
        evidence_signals: Dict[str, List[str]] = {k: [] for k in scores}

        # 1. Nutrition Facts Evidence (Strong signal for Food/Beverages)
        nutrition_matches = [p.pattern for p in self.NUTRITION_SIGNALS if p.search(text_corpus)]
        if nutrition_matches:
            weight = len(nutrition_matches) * 1.5
            scores[ProductCategory.PACKAGED_FOOD.value] += weight
            scores[ProductCategory.BEVERAGES.value] += weight * 0.7
            evidence_signals[ProductCategory.PACKAGED_FOOD.value].append(
                f"Nutrition facts declarations detected ({len(nutrition_matches)} matches)"
            )

        # 2. Ingredient List Evidence
        ingredient_matches = [p.pattern for p in self.INGREDIENT_SIGNALS if p.search(text_corpus)]
        if ingredient_matches:
            weight = len(ingredient_matches) * 1.2
            scores[ProductCategory.PACKAGED_FOOD.value] += weight
            evidence_signals[ProductCategory.PACKAGED_FOOD.value].append(
                f"Edible ingredient list markers detected ({len(ingredient_matches)} matches)"
            )

        # 3. Commodity-specific term matches
        for pat in self.FOOD_COMMODITY_SIGNALS:
            m = pat.search(text_corpus)
            if m:
                scores[ProductCategory.PACKAGED_FOOD.value] += 2.0
                evidence_signals[ProductCategory.PACKAGED_FOOD.value].append(f"Food commodity descriptor: '{m.group(0)}'")

        for pat in self.BEVERAGE_SIGNALS:
            m = pat.search(text_corpus)
            if m:
                scores[ProductCategory.BEVERAGES.value] += 2.2
                evidence_signals[ProductCategory.BEVERAGES.value].append(f"Beverage descriptor: '{m.group(0)}'")

        for pat in self.PERSONAL_CARE_SIGNALS:
            m = pat.search(text_corpus)
            if m:
                scores[ProductCategory.PERSONAL_CARE.value] += 2.0
                evidence_signals[ProductCategory.PERSONAL_CARE.value].append(f"Personal care / cosmetic descriptor: '{m.group(0)}'")

        for pat in self.HOUSEHOLD_CLEANING_SIGNALS:
            m = pat.search(text_corpus)
            if m:
                scores[ProductCategory.HOUSEHOLD_CLEANING.value] += 2.0
                evidence_signals[ProductCategory.HOUSEHOLD_CLEANING.value].append(f"Cleaning / household descriptor: '{m.group(0)}'")

        # Rank categories
        ranked = sorted(
            [(cat, score) for cat, score in scores.items() if cat != ProductCategory.OTHER_COMMODITY.value],
            key=lambda x: x[1],
            reverse=True,
        )
        top_cat, top_score = ranked[0]
        runner_up_score = ranked[1][1] if len(ranked) > 1 else 0.0

        # High confidence classification: score >= 2.0 and distinct from runner up
        if top_score >= 2.0 and (top_score - runner_up_score >= 0.5 or top_score >= 4.0):
            confidence = min(0.98, max(0.70, 0.65 + (top_score * 0.05)))
            return CategoryDetectionResult(
                category=top_cat,
                confidence=round(confidence, 2),
                detected_signals=evidence_signals[top_cat],
                is_verifiable=True,
                reason=f"Multi-signal evidence identified commodity as {top_cat} based on {len(evidence_signals[top_cat])} packaging indicators.",
            )

        # Moderate confidence (score >= 1.5)
        if top_score >= 1.5:
            confidence = 0.65
            return CategoryDetectionResult(
                category=top_cat,
                confidence=confidence,
                detected_signals=evidence_signals[top_cat],
                is_verifiable=True,
                reason=f"Moderate packaging signals suggest {top_cat}. Manual review recommended if commodity differs.",
            )

        # Insufficient or ambiguous signals: Fall back conservatively to "Other Packaged Commodity"
        # PCR 2011 Rule 6 declarations apply to all pre-packaged retail commodities
        return CategoryDetectionResult(
            category=ProductCategory.OTHER_COMMODITY.value,
            confidence=0.50,
            detected_signals=["General pre-packaged retail commodity declarations"],
            is_verifiable=False,
            reason="Insufficient category-specific declarations detected in submitted image(s); evaluated under general Legal Metrology (PCR 2011 Rule 6) retail requirements.",
        )


product_category_detector = ProductCategoryDetector()
