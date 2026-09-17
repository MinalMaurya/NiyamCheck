from typing import List
from backend.compliance.models import RuleEvaluation, RuleStatus, ComplianceStatus


def generate_findings(evaluations: List[RuleEvaluation]) -> List[str]:
    """Generates concise, human-readable findings from individual rule evaluations."""
    findings: List[str] = []

    for ev in evaluations:
        if ev.status == RuleStatus.PASS:
            findings.append(f"{ev.name}: detected and verified.")
        elif ev.status == RuleStatus.FAIL:
            findings.append(f"{ev.name}: {ev.reason}")
        elif ev.status == RuleStatus.UNCLEAR:
            findings.append(f"{ev.name}: requires review ({ev.reason})")
        elif ev.status == RuleStatus.NOT_VERIFIABLE:
            findings.append(f"{ev.name}: could not be verified from the image.")
        elif ev.status == RuleStatus.NOT_APPLICABLE:
            findings.append(f"{ev.name}: not applicable for this product packaging.")

    return findings


def generate_compliance_summary(
    status: ComplianceStatus,
    passed: int,
    failed: int,
    unclear: int,
    not_verifiable: int,
    total: int,
) -> str:
    """
    Generates an objective, conservative summary statement.
    Adheres strictly to the principle of never overclaiming full legal compliance.
    """
    if status == ComplianceStatus.COMPLIANT:
        return (
            f"Based on the declarations that could be verified from the submitted image, "
            f"all {passed} checked baseline requirements were satisfied. "
            "Note: This assessment is limited to observable text fields in Milestone 2."
        )

    if status == ComplianceStatus.NON_COMPLIANT:
        return (
            f"Compliance check identified {failed} confirmed issue(s) among the {total} evaluated rules. "
            "One or more required declarations were missing or failed statutory format requirements."
        )

    if status == ComplianceStatus.PARTIALLY_VERIFIABLE:
        pending = unclear + not_verifiable
        return (
            f"The submitted image contains {passed} verified declaration(s), but {pending} requirement(s) "
            "could not be reliably verified from the current image view. Additional packaging panels may be required."
        )

    # NOT_VERIFIABLE
    return (
        "Insufficient reliable declaration information could be verified from the submitted image. "
        "Please provide a clearer, higher-resolution photo of the package declarations."
    )
