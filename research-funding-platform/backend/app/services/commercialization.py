"""Commercialization recommendations: pathway fit (licensing, startup, productization, partnership,
grant-funded research), productization idea starters, licensing targets, partners, funding and risks.

Pathway fit scores are transparent weighted combinations of the five innovation-score components.
"""
from __future__ import annotations

from collections import Counter

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import taxonomy
from app.models import InnovationProject, Patent, User
from app.services import recommender, scoring

PATHWAYS = {
    "licensing": "License the technology to an established company",
    "startup": "Create a startup / spin-out venture",
    "productization": "Develop an in-house product or service",
    "industry_partnership": "Co-develop with an industry partner",
    "grant_research": "Pursue further grant-funded research",
}

NEXT_STEPS = {
    "licensing": ["Commission a patentability and freedom-to-operate search",
                  "Prepare a non-confidential technology summary for licensees",
                  "Engage your technology transfer office to identify licensees",
                  "Define field-of-use and royalty expectations"],
    "startup": ["Validate problem-solution fit with 15-20 customer discovery interviews",
                "Secure IP assignment/licence from your institution",
                "Apply to accelerators and pre-seed programmes in your domain",
                "Build a minimum viable product and define pilot customers"],
    "productization": ["Define a product requirements document and target users",
                       "Plan certification/regulatory requirements early",
                       "Run a paid pilot to validate pricing", "Set up manufacturing or delivery partners"],
    "industry_partnership": ["Shortlist companies active in your technology area",
                             "Prepare a joint development proposal with clear milestones",
                             "Agree background/foreground IP terms before starting",
                             "Look for co-funded industry-academia calls"],
    "grant_research": ["Target calls with high match scores in the funding module",
                       "Strengthen preliminary data and publications",
                       "Build a consortium for larger collaborative grants",
                       "Plan TRL progression milestones for the next 24 months"],
}

PRODUCT_IDEAS = {
    "ai_ml": [("Decision-intelligence SaaS", "Package the models as a subscription analytics service for {market}."),
              ("Model API / SDK", "Offer inference through a usage-priced API that partners embed in their software."),
              ("Edge AI module", "License an optimised on-device model to hardware OEMs.")],
    "nlp": [("Domain copilot", "A language assistant specialised for {market} workflows."),
            ("Document intelligence API", "Extraction and summarisation API for high-volume documents."),
            ("Multilingual interface layer", "Localisation and speech interface for regional-language users.")],
    "computer_vision": [("Automated visual inspection", "Camera-based quality inspection system for {market}."),
                        ("Imaging analytics platform", "Cloud platform that turns image streams into alerts and KPIs."),
                        ("Embedded vision kit", "Reference hardware + model bundle for integrators.")],
    "quantum": [("Quantum-ready algorithm library", "Licensable algorithms with classical fallbacks for {market}."),
                ("Quantum sensing device", "Ruggedised sensor product for precision measurement."),
                ("Post-quantum security toolkit", "Migration toolkit for quantum-safe cryptography.")],
    "clean_energy": [("Energy management system", "Software that optimises storage and generation assets for {market}."),
                     ("Battery diagnostics service", "State-of-health analytics sold per asset."),
                     ("Modular storage product", "Containerised storage unit for commercial sites.")],
    "biotech": [("Research reagent / kit", "Commercial kit enabling labs to reproduce the method."),
                ("Diagnostic assay", "Assay product developed with a clinical partner."),
                ("Platform licensing", "Out-license the platform for therapeutic programmes.")],
    "digital_health": [("Remote monitoring service", "Subscription monitoring service for {market}."),
                       ("Clinical decision support module", "Integrates with hospital EHR systems."),
                       ("Wellness companion app", "Consumer app with validated clinical content.")],
    "robotics": [("Robotics-as-a-service", "Lease robots with uptime guarantees to {market}."),
                 ("Autonomy software stack", "License navigation/manipulation software to OEMs."),
                 ("Inspection drone service", "Turnkey aerial inspection for infrastructure owners.")],
    "iot_edge": [("Connected monitoring kit", "Sensor + gateway bundle with a dashboard for {market}."),
                 ("Edge orchestration platform", "Software to deploy and update workloads on edge devices."),
                 ("Digital twin service", "Asset digital twins sold per site.")],
    "cybersecurity": [("Threat detection SaaS", "Managed detection product for {market}."),
                      ("Privacy compliance toolkit", "Automates data-protection compliance checks."),
                      ("Secure identity module", "Authentication component licensed to app developers.")],
    "advanced_materials": [("Specialty material supply", "Produce and sell the material to manufacturers in {market}."),
                           ("Coating / additive licence", "License the formulation to established producers."),
                           ("Materials testing service", "Characterisation services using the developed method.")],
    "climate_tech": [("Carbon accounting platform", "MRV software for emissions measurement in {market}."),
                     ("Treatment / capture unit", "Modular hardware unit sold or leased to industrial sites."),
                     ("Environmental monitoring network", "Sensor network with analytics subscriptions.")],
    "semiconductors": [("IP core licensing", "License the design as a semiconductor IP block."),
                       ("Specialised component", "Fabless product targeting {market}."),
                       ("Process-improvement service", "Yield/process consulting for fabs.")],
    "agritech": [("Precision farming advisory", "Farm-level recommendations app for {market}."),
                 ("Smart irrigation kit", "Low-cost sensor and controller bundle."),
                 ("Crop analytics for insurers/lenders", "Risk scores sold to financial institutions.")],
    "blockchain_fintech": [("Payments / ledger API", "Embedded finance API for {market}."),
                           ("Compliance automation", "RegTech workflow automation for financial firms."),
                           ("Tokenisation platform", "Asset tokenisation infrastructure for partners.")],
}


def _fit(comp: dict[str, float], role: str, project: scoring.ProjectInput) -> dict[str, float]:
    n, p, t, m, f = (comp["research_novelty"], comp["patent_strength"], comp["technology_maturity"],
                     comp["market_potential"], comp["funding_relevance"])
    t_mid = 100 - 2 * abs(t - 50)
    fits = {
        "licensing": 0.50 * p + 0.20 * n + 0.15 * m + 0.15 * t_mid,
        "startup": 0.35 * m + 0.25 * n + 0.20 * t + 0.20 * f + (5 if role == "startup_founder" else 0),
        "productization": 0.40 * t + 0.35 * m + 0.15 * p + 0.10 * f,
        "industry_partnership": 0.30 * m + 0.25 * t_mid + 0.25 * n + 0.20 * (60 if project.has_industry_partner else 100),
        "grant_research": 0.40 * f + 0.35 * n + 0.25 * (100 - t),
    }
    if project.trl < 6:
        fits["productization"] *= 0.8
    return {k: round(min(100.0, v), 1) for k, v in fits.items()}


def _rationale(key: str, comp: dict[str, float], project: scoring.ProjectInput) -> list[str]:
    n, p, t, m, f = (comp["research_novelty"], comp["patent_strength"], comp["technology_maturity"],
                     comp["market_potential"], comp["funding_relevance"])
    r = {
        "licensing": [f"Patent strength {p:.0f}/100 ({project.patents_granted} granted, "
                      f"{max(0, project.patents_filed - project.patents_granted)} pending)",
                      f"Technology maturity {t:.0f}/100 — licensees prefer validated but not fully productised technology"],
        "startup": [f"Market potential {m:.0f}/100 ({project.market_size.replace('_', ' ')} market)",
                    f"Novelty {n:.0f}/100 supports differentiation", f"Funding relevance {f:.0f}/100 for early capital"],
        "productization": [f"TRL {project.trl}/9 (maturity {t:.0f}/100)", f"Market potential {m:.0f}/100"],
        "industry_partnership": [f"Market potential {m:.0f}/100 and mid-stage maturity favour co-development",
                                 "Existing industry partner can be expanded" if project.has_industry_partner
                                 else "No industry partner yet — partnership would de-risk scale-up"],
        "grant_research": [f"Funding relevance {f:.0f}/100", f"Novelty {n:.0f}/100",
                           f"Maturity {t:.0f}/100 leaves room for research-stage funding"],
    }
    return r[key]


def _risks(comp: dict[str, float], project: scoring.ProjectInput) -> list[str]:
    risks = []
    if comp["patent_strength"] < 40:
        risks.append("Weak IP position: file before public disclosure and run a freedom-to-operate search.")
    if comp["technology_maturity"] < 40:
        risks.append(f"Low maturity (TRL {project.trl}): significant technical risk before market entry.")
    if comp["market_potential"] < 45:
        risks.append("Market potential is unclear: validate demand and willingness to pay.")
    if comp["funding_relevance"] < 40:
        risks.append("Few matching funding calls in the catalogue: diversify funding sources.")
    if comp["research_novelty"] < 40:
        risks.append("Limited novelty versus existing literature: sharpen the differentiating contribution.")
    if not project.has_industry_partner:
        risks.append("No committed industry partner yet.")
    return risks or ["No major risk flags from the scoring components; continue standard due diligence."]


def _licensing_targets(db: Session, project: scoring.ProjectInput, limit: int = 5) -> list[dict]:
    if not project.domain:
        return []
    patents = db.execute(select(Patent).where(Patent.owner_id.is_(None), Patent.technology_domain == project.domain)
                         ).scalars().all()
    if not patents:
        return []
    vec, matrix, rows = scoring._patents.get(db)
    q = vec.transform([project.text()])
    sims = (matrix @ q.T).toarray().ravel()
    pos = {r.id: i for i, r in enumerate(rows)}
    per: dict[str, list[float]] = {}
    for p in patents:
        if p.id in pos:
            per.setdefault(p.assignee or "Unassigned", []).append(float(sims[pos[p.id]]))
    ranked = sorted(per.items(), key=lambda kv: -(np.mean(sorted(kv[1], reverse=True)[:3]) * np.log1p(len(kv[1]))))
    return [{"assignee": a, "patents": len(v), "relevance": round(float(np.mean(sorted(v, reverse=True)[:3])), 3)}
            for a, v in ranked[:limit]]


def _academic_partners(project: scoring.ProjectInput, db: Session, limit: int = 3) -> list[dict]:
    vec, matrix, rows = scoring._publications.get(db)
    if not rows:
        return []
    sims = (matrix @ vec.transform([project.text()]).T).toarray().ravel()
    out = []
    for i in np.argsort(sims)[::-1][:limit]:
        pub = rows[int(i)]
        lead = (pub.authors or ["Unknown"])[0]
        out.append({"name": f"{lead} et al.", "type": "academic",
                    "reason": f"Authors of closely related work: \"{pub.title}\" ({pub.year}, {pub.venue or 'n/a'})"})
    return out


def analyse(db: Session, project: InnovationProject, user: User) -> dict:
    owner = db.get(User, project.owner_id) or user
    pin = scoring.ProjectInput.from_project(project)
    latest = project.latest_score
    if latest is None:
        result = scoring.compute(db, pin, owner)
        latest = scoring.persist(db, project, result, user)
    score_out = scoring.to_out(latest)
    comp = {c["key"]: c["value"] for c in score_out["components"]}
    fits = _fit(comp, owner.role, pin)
    ranked = sorted(fits.items(), key=lambda kv: -kv[1])
    recommended = {ranked[0][0]} | {k for k, v in ranked[1:2] if v >= 55}
    pathways = [{"key": k, "title": PATHWAYS[k], "fit_score": v, "recommended": k in recommended,
                 "rationale": _rationale(k, comp, pin), "next_steps": NEXT_STEPS[k]} for k, v in ranked]
    market = pin.target_market or "target customers"
    ideas = [{"title": t, "description": d.format(market=market)} for t, d in PRODUCT_IDEAS.get(pin.domain or "", [])]
    targets = _licensing_targets(db, pin)
    partners = [{"name": t["assignee"], "type": "industry",
                 "reason": f"{t['patents']} related patents in {taxonomy.area_name(pin.domain)} (relevance {t['relevance']})"}
                for t in targets[:3]] + _academic_partners(pin, db)
    funding = recommender.recommend(db, owner, limit=5, project=project)["items"]
    top = pathways[0]
    summary = (f"Best-fit pathway: {top['title'].lower()} (fit {top['fit_score']}/100). Innovation score "
               f"{score_out['overall']} ({score_out['band']}). Recommendations are heuristic starting points for "
               "discussion with your technology transfer office or advisors.")
    return {"project": None, "score": score_out, "summary": summary, "pathways": pathways,
            "productization_ideas": ideas, "licensing_targets": targets, "partners": partners,
            "funding": funding, "risks": _risks(comp, pin)}


def overview(db: Session, projects: list[InnovationProject]) -> dict:
    items = []
    for p in projects:
        latest = p.latest_score
        if latest is None:
            items.append({"project_id": p.id, "title": p.title, "overall": None, "band": None,
                          "top_pathway": None, "top_pathway_title": None, "fit_score": None})
            continue
        comp = {"research_novelty": latest.research_novelty, "patent_strength": latest.patent_strength,
                "technology_maturity": latest.technology_maturity, "market_potential": latest.market_potential,
                "funding_relevance": latest.funding_relevance}
        owner_role = p.owner.role if p.owner else "researcher"
        fits = _fit(comp, owner_role, scoring.ProjectInput.from_project(p))
        key, val = max(fits.items(), key=lambda kv: kv[1])
        items.append({"project_id": p.id, "title": p.title, "overall": latest.overall, "band": latest.band,
                      "top_pathway": key, "top_pathway_title": PATHWAYS[key], "fit_score": val})
    return {"items": items, "pathway_counts": dict(Counter(i["top_pathway"] for i in items if i["top_pathway"]))}
