from typing import List, Optional
from backend.schemas.analysis import ExtractedFields, FieldResult
from backend.compliance.models import (
    RuleDefinition,
    RuleEvaluation,
    RuleStatus,
    ComplianceStatus,
    ComplianceResult,
)
from backend.compliance.rules import DEFAULT_RULES, RULE_VALIDATOR_MAP, get_applicable_rules
from backend.compliance.explanations import (
    generate_findings,
    generate_compliance_summary,
)


class ComplianceRuleEngine:
    """
    Deterministic, explainable Legal Metrology compliance rule engine.
    Evaluates extracted packaging declarations against statutory rule definitions.
    """

    def __init__(self, rules: Optional[List[RuleDefinition]] = None):
        self.rules = rules or DEFAULT_RULES

    def evaluate(
        self,
        fields: ExtractedFields,
        category: Optional[str] = None,
        context: Optional[dict] = None,
    ) -> ComplianceResult:
        """
        Executes rule-by-rule evaluation against the extracted product declarations.
        Returns an auditable, structured ComplianceResult.
        """
        evaluations: List[RuleEvaluation] = []

        passed_count = 0
        failed_count = 0
        unclear_count = 0
        not_verifiable_count = 0
        not_applicable_count = 0

        rules_to_evaluate = (
            get_applicable_rules(category, context)
            if (category and self.rules == DEFAULT_RULES)
            else self.rules
        )

        for rule in rules_to_evaluate:
            # 1. Retrieve the corresponding extracted field
            field_obj: Optional[FieldResult[str]] = getattr(fields, rule.field_name, None)

            # Fallback if field does not exist in schema
            if field_obj is None:
                field_obj = FieldResult[str]()

            # 2. Retrieve and run the registered validator
            validator_func = RULE_VALIDATOR_MAP.get(rule.rule_id)
            if validator_func:
                status, reason, evidence, confidence = validator_func(field_obj)
            else:
                # Default presence fallback if no specialized validator is registered
                from backend.compliance.validators import validate_product_name
                status, reason, evidence, confidence = validate_product_name(field_obj)

            # 3. Increment counters
            if status == RuleStatus.PASS:
                passed_count += 1
            elif status in (RuleStatus.FAIL, RuleStatus.POTENTIAL_ISSUE):
                failed_count += 1
            elif status in (RuleStatus.UNCLEAR, RuleStatus.REVIEW):
                unclear_count += 1
            elif status == RuleStatus.NOT_VERIFIABLE:
                not_verifiable_count += 1
            elif status == RuleStatus.NOT_APPLICABLE:
                not_applicable_count += 1

            # 4. Record rule evaluation
            evaluations.append(
                RuleEvaluation(
                    rule_id=rule.rule_id,
                    name=rule.name,
                    category=rule.category.value,
                    requirement=rule.requirement,
                    status=status,
                    reason=reason,
                    evidence=evidence,
                    confidence=round(confidence, 2),
                    field=rule.field_name,
                    applicability=rule.severity.value,
                    expected_declaration=rule.expected_declaration,
                    evidence_required=rule.evidence_required,
                    legal_source=rule.legal_source_ref,
                )
            )

        total_checked = len(evaluations)

        # 5. Determine overall compliance status using conservative logic
        if failed_count > 0:
            overall_status = ComplianceStatus.NON_COMPLIANT
        elif passed_count > 0 and (unclear_count > 0 or not_verifiable_count > 0):
            overall_status = ComplianceStatus.PARTIALLY_VERIFIABLE
        elif passed_count > 0 and unclear_count == 0 and not_verifiable_count == 0:
            overall_status = ComplianceStatus.COMPLIANT
        else:
            # When zero rules pass (all NOT_VERIFIABLE, UNCLEAR, or empty)
            overall_status = ComplianceStatus.NOT_VERIFIABLE

        # 6. Generate summary and findings
        summary = generate_compliance_summary(
            status=overall_status,
            passed=passed_count,
            failed=failed_count,
            unclear=unclear_count,
            not_verifiable=not_verifiable_count,
            total=total_checked,
        )
        findings = generate_findings(evaluations)

        return ComplianceResult(
            status=overall_status,
            summary=summary,
            rules_checked=total_checked,
            rules_passed=passed_count,
            rules_failed=failed_count,
            rules_unclear=unclear_count,
            rules_not_verifiable=not_verifiable_count,
            rules_not_applicable=not_applicable_count,
            evaluations=evaluations,
            findings=findings,
        )


compliance_engine = ComplianceRuleEngine()
