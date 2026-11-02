"""Seed the database from the snapshot files in ../data and create demo accounts/projects.

    python -m app.seed.seed              # idempotent: loads anything that is missing
    python -m app.seed.seed --reset      # delete all rows first, then seed again
    python -m app.seed.seed --no-demo    # datasets only (no demo users/projects)

Run `alembic upgrade head` first. Demo accounts use DEMO_USER_PASSWORD from .env (see .env.example) and are
for local demonstrations only — set SEED_DEMO_USERS=false for real deployments.
"""
from __future__ import annotations

import argparse
import json
import logging
import sys

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal
from app.models import (FundingOpportunity, InnovationProject, Patent, Publication, ResearchHistoryEntry,
                        ResearchProfile, SavedFunding, TrendPoint, User)
from app.services import alerts, audit, data_import, recommender, scoring

logger = logging.getLogger("rfip.seed")

DEMO_USERS = [
    {"email": "admin@example.com", "full_name": "Asha Verma (Demo Admin)", "role": "admin",
     "organization": "RFIP Platform Team",
     "profile": {"headline": "Platform administrator", "organization_type": "other", "country": "India",
                 "career_stage": "industry", "research_domains": ["ai_ml"], "keywords": ["research analytics"],
                 "technology_areas": ["ai_ml"]}},
    {"email": "researcher@example.com", "full_name": "Dr. Kavya Nair (Demo Researcher)", "role": "researcher",
     "organization": "Westbrook University (fictional)",
     "profile": {"headline": "Associate Professor, Biomedical AI",
                 "bio": "Works on trustworthy machine learning for healthcare: federated learning across hospitals, "
                        "explainable medical imaging models and wearable sensor analytics for remote patient monitoring.",
                 "department": "Computer Science & Engineering", "organization_name": "Westbrook University (fictional)",
                 "organization_type": "university", "country": "India", "career_stage": "mid_career",
                 "research_domains": ["ai_ml", "digital_health"],
                 "keywords": ["federated learning", "medical imaging", "clinical decision support", "explainable ai",
                              "wearable sensors", "deep learning"],
                 "technology_areas": ["computer_vision", "digital_health"], "orcid": ""}},
    {"email": "founder@example.com", "full_name": "Rohan Mehta (Demo Founder)", "role": "startup_founder",
     "organization": "VoltLeaf Energy (demo startup)",
     "profile": {"headline": "Co-founder & CTO, VoltLeaf Energy",
                 "bio": "Building battery analytics and edge AI for solar microgrids and commercial energy storage.",
                 "organization_name": "VoltLeaf Energy (demo startup)", "organization_type": "startup",
                 "country": "India", "career_stage": "industry", "research_domains": ["clean_energy", "iot_edge"],
                 "keywords": ["battery management", "solar microgrid", "energy storage", "predictive maintenance",
                              "edge analytics", "smart grid"],
                 "technology_areas": ["clean_energy", "iot_edge", "ai_ml"]}},
    {"email": "manager@example.com", "full_name": "Meera Iyer (Demo Innovation Manager)", "role": "innovation_manager",
     "organization": "Westbrook University Technology Transfer Office (fictional)",
     "profile": {"headline": "Head of Technology Transfer", "organization_name": "Westbrook University (fictional)",
                 "organization_type": "university", "country": "India", "career_stage": "senior",
                 "research_domains": ["ai_ml", "biotech", "climate_tech"],
                 "keywords": ["technology transfer", "licensing", "spin-out", "innovation portfolio"],
                 "technology_areas": ["biotech", "climate_tech", "advanced_materials"]}},
    {"email": "l.okafor@example.com", "full_name": "Dr. Lena Okafor (Demo)", "role": "researcher",
     "organization": "Oriel Institute of Technology (fictional)",
     "profile": {"organization_type": "university", "country": "Kenya", "career_stage": "early_career",
                 "research_domains": ["agritech", "biotech"], "keywords": ["crop pathogens", "crispr", "food security"],
                 "technology_areas": ["agritech"]}},
    {"email": "j.weber@example.com", "full_name": "Jonas Weber (Demo)", "role": "researcher",
     "organization": "Oriel Institute of Technology (fictional)",
     "profile": {"organization_type": "research_institute", "country": "Germany", "career_stage": "senior",
                 "research_domains": ["quantum", "semiconductors"],
                 "keywords": ["quantum algorithm", "photonics", "optimization"], "technology_areas": ["quantum"]}},
    {"email": "s.tan@example.com", "full_name": "Sarah Tan (Demo)", "role": "startup_founder",
     "organization": "AgriPulse Labs (demo startup)",
     "profile": {"organization_type": "startup", "country": "Singapore", "career_stage": "industry",
                 "research_domains": ["agritech", "iot_edge"], "keywords": ["soil moisture", "sensor network",
                                                                             "precision agriculture"],
                 "technology_areas": ["agritech", "iot_edge"]}},
    {"email": "m.garcia@example.com", "full_name": "Mateo Garcia (Demo)", "role": "startup_founder",
     "organization": "SecureGrid Systems (demo startup)",
     "profile": {"organization_type": "startup", "country": "United States", "career_stage": "industry",
                 "research_domains": ["cybersecurity", "iot_edge"], "keywords": ["zero trust", "anomaly detection",
                                                                                 "industrial iot"],
                 "technology_areas": ["cybersecurity"]}},
    {"email": "p.shah@example.com", "full_name": "Dr. Priya Shah (Demo)", "role": "researcher",
     "organization": "Westbrook University (fictional)",
     "profile": {"organization_type": "university", "country": "United Kingdom", "career_stage": "mid_career",
                 "research_domains": ["nlp", "digital_health"], "keywords": ["speech recognition", "low-resource languages",
                                                                              "clinical notes"],
                 "technology_areas": ["nlp"]}},
]

DEMO_PROJECTS = [
    ("researcher@example.com", "Federated learning for privacy-preserving diabetic retinopathy screening",
     "A federated deep learning system that trains retinal image classifiers across hospitals without sharing patient "
     "data, with explainable heatmaps for clinicians and on-device inference for rural screening camps.",
     "digital_health", ["federated learning", "medical imaging", "explainable ai", "diabetic retinopathy"], "prototype", 4,
     "large", "Hospitals and teleophthalmology providers", 1, 0, 5, False),
    ("researcher@example.com", "Explainable ECG anomaly detection on wearable devices",
     "Lightweight neural networks that detect arrhythmias from single-lead wearable ECG signals and explain each alert "
     "to cardiologists, designed for remote patient monitoring programmes.",
     "digital_health", ["wearable", "ecg", "remote patient monitoring", "explainable ai"], "research", 3, "medium",
     "Remote cardiac monitoring services", 0, 0, 3, False),
    ("founder@example.com", "Solar microgrid battery health analytics platform",
     "Cloud platform that estimates battery state of health and remaining useful life for solar microgrids using "
     "physics-informed machine learning, reducing unplanned outages and extending storage asset life.",
     "clean_energy", ["battery", "energy storage", "solar microgrid", "predictive maintenance"], "pilot", 6, "large",
     "Microgrid operators and C&I solar owners", 2, 1, 8, True),
    ("founder@example.com", "Edge AI predictive maintenance for rooftop solar inverters",
     "Embedded edge analytics that detect inverter faults from power-electronics telemetry in real time and trigger "
     "maintenance before failures, working offline on low-cost IoT gateways.",
     "iot_edge", ["edge computing", "predictive maintenance", "solar", "iot"], "prototype", 5, "medium",
     "Solar O&M companies", 1, 0, 8, False),
    ("l.okafor@example.com", "CRISPR-based rapid diagnostic for crop pathogens",
     "A paper-strip CRISPR assay that detects cassava and maize pathogens in the field within 30 minutes, enabling "
     "smallholder farmers and extension workers to act early.",
     "biotech", ["crispr", "diagnostics", "crop", "food security"], "research", 3, "medium",
     "Agricultural extension services", 0, 0, 4, False),
    ("s.tan@example.com", "Low-cost soil moisture sensing network for smallholder farms",
     "Solar-powered soil moisture sensors with LoRa connectivity and an irrigation advisory app that reduces water use "
     "while protecting yields for smallholder farmers.",
     "agritech", ["precision agriculture", "irrigation", "sensor network", "soil"], "pilot", 7, "large",
     "Smallholder farmer cooperatives", 1, 1, 6, True),
    ("j.weber@example.com", "Quantum-inspired optimisation for logistics routing",
     "Quantum-inspired annealing algorithms running on classical hardware to solve large vehicle-routing problems, "
     "with a migration path to quantum processors as they mature.",
     "quantum", ["quantum algorithm", "optimization", "logistics", "quantum simulation"], "idea", 2, "large",
     "Logistics and fleet operators", 0, 0, 2, False),
    ("manager@example.com", "Graphene-enhanced anti-corrosion coatings",
     "Graphene nanoplatelet additives for marine and infrastructure coatings that double corrosion resistance at a "
     "modest cost premium; validated in accelerated salt-spray tests.",
     "advanced_materials", ["graphene", "coating", "nanomaterials", "corrosion"], "prototype", 5, "large",
     "Marine and infrastructure coating manufacturers", 2, 1, 6, True),
    ("manager@example.com", "Direct air capture sorbent with low regeneration energy",
     "Amine-functionalised porous sorbent that captures CO2 from ambient air and regenerates at lower temperature, "
     "reducing the energy cost of direct air capture.",
     "climate_tech", ["carbon capture", "sorbent", "emissions", "climate change"], "research", 4, "very_large",
     "Carbon removal project developers", 1, 0, 5, False),
    ("p.shah@example.com", "Multilingual clinical speech-to-text for regional languages",
     "Speech recognition and clinical note generation for low-resource regional languages, fine-tuned on consented "
     "doctor-patient conversations to reduce documentation time.",
     "nlp", ["speech recognition", "language model", "clinical notes", "machine translation"], "prototype", 5, "large",
     "Hospitals and telehealth platforms", 0, 0, 4, False),
    ("m.garcia@example.com", "Zero-trust anomaly detection for industrial IoT",
     "Network anomaly detection and zero-trust access control for factory IoT devices, deployed as a hardened edge "
     "appliance with a managed security dashboard.",
     "cybersecurity", ["zero trust", "intrusion detection", "industrial iot", "anomaly detection"], "market_ready", 8,
     "large", "Mid-size manufacturers", 3, 2, 12, True),
    ("j.weber@example.com", "Photonic integrated circuit for low-power optical interconnects",
     "Silicon photonic transceiver design that cuts data-centre interconnect energy per bit using micro-ring modulators "
     "and co-packaged optics.",
     "semiconductors", ["photonics", "integrated circuit", "optoelectronics", "packaging"], "research", 3, "very_large",
     "Data-centre hardware vendors", 1, 0, 3, False),
]

DEMO_PUBLICATIONS = [
    ("Federated learning of retinal image classifiers across hospitals: a multi-site evaluation (demo record)",
     2024, 18, "digital_health", ["federated learning", "medical imaging"]),
    ("Explainable deep learning for diabetic retinopathy grading (demo record)", 2023, 42, "ai_ml",
     ["explainable ai", "deep learning"]),
    ("Wearable ECG arrhythmia detection with lightweight neural networks (demo record)", 2022, 27, "digital_health",
     ["wearable", "ecg"]),
    ("Clinical decision support with uncertainty-aware models (demo record)", 2021, 11, "ai_ml",
     ["clinical decision support", "uncertainty"]),
]

DEMO_HISTORY = [
    ("position", "Associate Professor", "Faculty", "Westbrook University (fictional)", 2021, None,
     "Leads the Trustworthy Health AI group."),
    ("grant", "Federated AI for rural eye screening (demo grant)", "Principal investigator",
     "Example National Research Council", 2023, 2025, "Illustrative grant entry for demonstration."),
    ("education", "PhD in Computer Science", None, "Oriel Institute of Technology (fictional)", 2012, 2016, None),
]


def _load_json(name: str) -> dict | None:
    path = get_settings().data_path / name
    if not path.exists():
        logger.warning("data file %s not found - skipping", name)
        return None
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def reset(db: Session) -> None:
    for table in reversed(Base.metadata.sorted_tables):
        db.execute(delete(table))
    db.commit()


def seed_datasets(db: Session) -> dict:
    counts = {}
    if db.execute(select(func.count(TrendPoint.id))).scalar_one() == 0:
        payload = _load_json("publication_trends_openalex.json")
        counts["trend_points"] = data_import.load_trends(db, payload) if payload else 0
    if db.execute(select(func.count(Publication.id)).where(Publication.owner_id.is_(None))).scalar_one() == 0:
        payload = _load_json("publications_openalex.json") or {"records": []}
        for rec in payload["records"]:
            data_import.add_publication(db, rec, source="openalex")
        counts["publications"] = len(payload["records"])
    for name, record_type in (("funding_verified_grantsgov.json", "verified"), ("funding_illustrative.json", "illustrative")):
        payload = _load_json(name) or {"records": []}
        for rec in payload["records"]:
            data_import.upsert_funding(db, rec, record_type)
        counts[f"funding_{record_type}"] = len(payload["records"])
    if db.execute(select(func.count(Patent.id)).where(Patent.record_type == "illustrative")).scalar_one() == 0:
        payload = _load_json("patents_illustrative.json") or {"records": []}
        for rec in payload["records"]:
            data_import.add_patent(db, rec, "illustrative", "illustrative-generator")
        counts["patents"] = len(payload["records"])
    db.commit()
    recommender.funding_index.invalidate()
    return counts


def seed_demo(db: Session) -> dict:
    settings = get_settings()
    users: dict[str, User] = {}
    created = 0
    for spec in DEMO_USERS:
        user = db.execute(select(User).where(User.email == spec["email"])).scalar_one_or_none()
        if user is None:
            user = User(email=spec["email"], full_name=spec["full_name"], role=spec["role"],
                        organization=spec["organization"], hashed_password=hash_password(settings.demo_user_password))
            db.add(user)
            db.flush()
            fields = {"research_domains": [], "keywords": [], "technology_areas": [],
                      "organization_name": spec["organization"], **spec["profile"]}
            profile = ResearchProfile(user_id=user.id, **fields)
            db.add(profile)
            created += 1
        users[spec["email"]] = user
    db.commit()
    if not created:
        return {"users": 0, "projects": 0}

    researcher = users["researcher@example.com"]
    for title, year, cites, domain, kws in DEMO_PUBLICATIONS:
        db.add(Publication(owner_id=researcher.id, title=title, year=year, citation_count=cites, domain=domain,
                           keywords=kws, authors=["Kavya Nair (demo)", "Co-author (demo)"], venue="Demo record",
                           pub_type="journal-article", source="manual"))
    for kind, title, role, inst, start, end, desc in DEMO_HISTORY:
        db.add(ResearchHistoryEntry(user_id=researcher.id, kind=kind, title=title, role=role, institution=inst,
                                    start_year=start, end_year=end, description=desc))
    founder = users["founder@example.com"]
    db.add(Patent(owner_id=founder.id, patent_number="ILLUS-USER-0001",
                  title="Battery state-of-health estimation for distributed solar storage (demo record)",
                  abstract="Illustrative user-entered patent application used in the demo.", assignee="VoltLeaf Energy (demo startup)",
                  inventors=["Rohan Mehta (demo)"], status="pending", classification="H01M 10/48",
                  technology_domain="clean_energy", citation_count=3, jurisdiction="IN", source="user", record_type="user"))
    db.commit()

    projects = []
    for (email, title, desc, domain, kws, stage, trl, market, target, filed, granted, team, partner) in DEMO_PROJECTS:
        p = InnovationProject(owner_id=users[email].id, title=title, description=desc, domain=domain, keywords=kws,
                              stage=stage, trl=trl, market_size=market, target_market=target, patents_filed=filed,
                              patents_granted=granted, team_size=team, has_industry_partner=partner)
        db.add(p)
        projects.append(p)
    db.commit()
    for p in projects:
        owner = db.get(User, p.owner_id)
        result = scoring.compute(db, scoring.ProjectInput.from_project(p), owner)
        scoring.persist(db, p, result, owner)

    for email, n in (("researcher@example.com", 3), ("founder@example.com", 2)):
        recs = recommender.recommend(db, users[email], limit=n, log=True)["items"]
        for r in recs:
            db.add(SavedFunding(user_id=users[email].id, funding_id=r["funding"]["id"], status="interested",
                                notes="Saved during demo seeding"))
    db.commit()
    for user in users.values():
        recommender.recommend(db, user, limit=5, log=True)
    alerts.broadcast(db, "Welcome to the Research Funding & Innovation Intelligence Platform",
                     "Explore personalised funding matches, research and patent intelligence, and innovation scoring. "
                     "Records marked 'Illustrative' are demo data; 'Verified' records come from official sources.", None)
    alerts.generate_all(db)
    audit.record(db, "seed.completed", None, email="system", detail={"demo_users": created, "projects": len(projects)})
    return {"users": created, "projects": len(projects)}


def run(reset_first: bool = False, demo: bool = True) -> dict:
    db = SessionLocal()
    try:
        if reset_first:
            reset(db)
        summary = {"datasets": seed_datasets(db)}
        if demo and get_settings().seed_demo_users:
            summary["demo"] = seed_demo(db)
        return summary
    finally:
        db.close()


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="Seed the RFIP database")
    parser.add_argument("--reset", action="store_true", help="delete existing rows before seeding")
    parser.add_argument("--no-demo", action="store_true", help="skip demo users and projects")
    args = parser.parse_args()
    summary = run(reset_first=args.reset, demo=not args.no_demo)
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
