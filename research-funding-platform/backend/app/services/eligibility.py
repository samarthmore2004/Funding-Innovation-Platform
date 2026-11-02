"""Rule-based eligibility matching between an applicant context and a funding opportunity."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from app.core import taxonomy

ORG_TO_APPLICANT = {
    "university": {"university", "researcher"},
    "research_institute": {"nonprofit", "researcher"},
    "startup": {"startup"},
    "enterprise": {"enterprise"},
    "government": {"government"},
    "nonprofit": {"nonprofit"},
}
ROLE_TO_APPLICANT = {
    "researcher": {"researcher"},
    "startup_founder": {"startup"},
    "innovation_manager": set(),
    "admin": {"researcher"},
}


@dataclass
class ApplicantContext:
    role: str
    applicant_types: set[str] = field(default_factory=set)
    country: str | None = None
    career_stage: str | None = None
    organization_type: str | None = None


def build_context(user, profile) -> ApplicantContext:
    types = set(ROLE_TO_APPLICANT.get(user.role, set()))
    org_type = profile.organization_type if profile else None
    if org_type:
        types |= ORG_TO_APPLICANT.get(org_type, set())
    if not types:
        types = {"university", "researcher"}
    return ApplicantContext(
        role=user.role,
        applicant_types=types,
        country=(profile.country if profile else None) or None,
        career_stage=(profile.career_stage if profile else None) or None,
        organization_type=org_type,
    )


def _country_ok(eligible: list[str], country: str | None) -> tuple[bool | None, str]:
    if not eligible or "Global" in eligible:
        return True, "Open to applicants worldwide"
    if not country:
        return None, f"Restricted to {', '.join(eligible[:4])}; add your country to your profile to confirm"
    if country in eligible:
        return True, f"{country} is an eligible country"
    if "European Union" in eligible and country in taxonomy.EU_COUNTRIES:
        return True, f"{country} is an EU member state"
    return False, f"Restricted to {', '.join(eligible[:4])}{'…' if len(eligible) > 4 else ''}; {country} is not listed"


def evaluate(funding, ctx: ApplicantContext, today: date | None = None) -> dict:
    today = today or date.today()
    checks: list[dict] = []

    # 1. Deadline / status
    if funding.status == "closed":
        checks.append({"criterion": "Deadline", "passed": False, "detail": "This call is closed"})
    elif funding.deadline and funding.deadline < today:
        checks.append({"criterion": "Deadline", "passed": False,
                       "detail": f"Deadline passed on {funding.deadline.isoformat()}"})
    elif funding.deadline:
        days = (funding.deadline - today).days
        checks.append({"criterion": "Deadline", "passed": True,
                       "detail": f"{days} day(s) left (deadline {funding.deadline.isoformat()})"})
    else:
        checks.append({"criterion": "Deadline", "passed": True,
                       "detail": "Rolling or not yet announced — check the source for timing"})

    # 2. Applicant type
    allowed = set(funding.applicant_types or [])
    if not allowed:
        checks.append({"criterion": "Applicant type", "passed": None, "detail": "Applicant types not specified"})
    else:
        overlap = allowed & ctx.applicant_types
        labels = ", ".join(taxonomy.APPLICANT_TYPES.get(t, t) for t in sorted(allowed))
        if overlap:
            checks.append({"criterion": "Applicant type", "passed": True,
                           "detail": f"You qualify as: {', '.join(taxonomy.APPLICANT_TYPES.get(t, t) for t in sorted(overlap))}"})
        else:
            checks.append({"criterion": "Applicant type", "passed": False, "detail": f"Open to: {labels}"})

    # 3. Country / region
    passed, detail = _country_ok(list(funding.eligible_countries or []), ctx.country)
    checks.append({"criterion": "Country / region", "passed": passed, "detail": detail})

    # 4. Career stage
    stages = list(funding.career_stages or [])
    if not stages:
        checks.append({"criterion": "Career stage", "passed": True, "detail": "No career-stage restriction"})
    elif not ctx.career_stage:
        checks.append({"criterion": "Career stage", "passed": None,
                       "detail": "Career-stage restricted; add your career stage to your profile"})
    elif ctx.career_stage in stages:
        checks.append({"criterion": "Career stage", "passed": True,
                       "detail": f"Open to {taxonomy.CAREER_STAGES.get(ctx.career_stage, ctx.career_stage)}"})
    else:
        checks.append({"criterion": "Career stage", "passed": False,
                       "detail": "Open to: " + ", ".join(taxonomy.CAREER_STAGES.get(s, s) for s in stages)})

    failed = any(c["passed"] is False for c in checks)
    unknown = any(c["passed"] is None for c in checks)
    score = sum(1.0 if c["passed"] else (0.5 if c["passed"] is None else 0.0) for c in checks) / len(checks)
    status = "ineligible" if failed else ("partially_eligible" if unknown else "eligible")
    return {"status": status, "score": round(score, 3), "checks": checks}
