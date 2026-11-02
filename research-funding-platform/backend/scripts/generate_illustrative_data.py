"""Generate the ILLUSTRATIVE (synthetic) datasets shipped in ../data.

    python -m scripts.generate_illustrative_data

* data/patents_illustrative.json  – synthetic patents with invented assignees and ILLUS-* numbers.
  No free, keyless patent API exists (PatentsView / USPTO ODP / Lens need keys), so the demo uses synthetic
  records that are clearly labelled. Real data can be imported from Google Patents / Lens CSV exports.
* data/funding_illustrative.json  – synthetic calls covering funder categories that Grants.gov does not
  (accelerators, venture programmes, research councils, international agencies). Organisation names are
  invented; deadlines are stored as offsets and resolved at seed time so the demo never goes stale.

The generator is deterministic (fixed random seed). Real-looking but invented names are used; any
resemblance to real organisations, people or patents is coincidental.
"""
from __future__ import annotations

import json
import random
from datetime import date, timedelta

from app.core import taxonomy
from app.core.config import get_settings

RNG = random.Random(2026)

CPC_GROUPS = {
    "ai_ml": ["G06N 3/08", "G06N 20/00", "G06N 5/04"],
    "nlp": ["G06F 40/30", "G06F 40/40", "G10L 15/16"],
    "computer_vision": ["G06V 10/82", "G06T 7/00", "G06V 40/16"],
    "quantum": ["G06N 10/00", "G06N 10/20", "H04L 9/0852"],
    "clean_energy": ["H01M 10/052", "H02J 3/38", "H01M 8/04"],
    "biotech": ["C12N 15/11", "C12N 9/22", "C12Q 1/68"],
    "digital_health": ["G16H 50/20", "G16H 40/67", "A61B 5/00"],
    "robotics": ["B25J 9/16", "B25J 13/08", "G05D 1/00"],
    "iot_edge": ["H04L 67/12", "H04W 4/70", "G16Y 40/10"],
    "cybersecurity": ["H04L 63/14", "H04L 9/32", "G06F 21/55"],
    "advanced_materials": ["B82Y 30/00", "C01B 32/182", "C08K 3/04"],
    "climate_tech": ["B01D 53/62", "Y02C 20/40", "C02F 1/44"],
    "semiconductors": ["H01L 21/02", "H01L 23/00", "G02B 6/12"],
    "agritech": ["A01B 79/005", "A01G 25/16", "A01G 9/24"],
    "blockchain_fintech": ["G06Q 20/40", "G06Q 40/04", "H04L 9/50"],
}

# yearly volume multipliers 2012..2025 shape the synthetic filing trends per area
GROWTH = {
    "ai_ml": 1.22, "nlp": 1.30, "computer_vision": 1.15, "quantum": 1.33, "clean_energy": 1.10,
    "biotech": 1.12, "digital_health": 1.17, "robotics": 1.09, "iot_edge": 1.06, "cybersecurity": 1.11,
    "advanced_materials": 1.04, "climate_tech": 1.18, "semiconductors": 1.07, "agritech": 1.13,
    "blockchain_fintech": None,
}
VOLUME = {"ai_ml": 60, "nlp": 38, "computer_vision": 42, "quantum": 30, "clean_energy": 45, "biotech": 40,
          "digital_health": 38, "robotics": 36, "iot_edge": 34, "cybersecurity": 36, "advanced_materials": 28,
          "climate_tech": 30, "semiconductors": 34, "agritech": 26, "blockchain_fintech": 26}

ASSIGNEES = {
    "Qubitora Systems": ["quantum", "semiconductors"],
    "Helixane Bio": ["biotech", "digital_health"],
    "Robonexa Industries": ["robotics", "computer_vision", "agritech"],
    "Gridovo Energy": ["clean_energy", "iot_edge"],
    "Agrivanta Labs": ["agritech", "climate_tech"],
    "Lumetric Photonics": ["semiconductors", "quantum"],
    "Cyberlume Security": ["cybersecurity", "blockchain_fintech"],
    "Edgewyn Networks": ["iot_edge", "cybersecurity"],
    "Graphenix Materials": ["advanced_materials", "clean_energy"],
    "Medivora Devices": ["digital_health", "computer_vision"],
    "Visiomatic AI": ["computer_vision", "ai_ml"],
    "Lexivo Language Technologies": ["nlp", "ai_ml"],
    "Ledgerine Finance": ["blockchain_fintech"],
    "Carbovia Climate": ["climate_tech", "advanced_materials"],
    "Neurozen AI": ["ai_ml", "nlp", "digital_health"],
    "Synthara Biosciences": ["biotech"],
    "Voltaris Storage": ["clean_energy"],
    "Aerodynix Drones": ["robotics", "agritech"],
    "Cognisphere Labs": ["ai_ml", "quantum", "nlp"],
    "Silicorex Semiconductor": ["semiconductors", "iot_edge"],
    "Hydrava Water Tech": ["climate_tech"],
    "Nanovex Coatings": ["advanced_materials"],
    "Pulsewell Health": ["digital_health", "iot_edge"],
    "Tessaract Robotics": ["robotics", "ai_ml"],
    "Cryptova Labs": ["blockchain_fintech", "cybersecurity"],
    "Oriel Institute of Technology (fictional)": ["ai_ml", "quantum", "biotech", "advanced_materials"],
    "Westbrook University (fictional)": ["nlp", "climate_tech", "agritech", "digital_health"],
    "Kestrel Mobility": ["robotics", "computer_vision", "clean_energy"],
    "Brightloom Analytics": ["ai_ml", "blockchain_fintech", "iot_edge"],
    "Verdexa Foods": ["agritech", "biotech"],
}

TITLE_TEMPLATES = [
    "System and method for {a} using {b}",
    "Method of {a} with adaptive {b}",
    "Apparatus for {a} based on {b}",
    "{A} platform employing {b}",
    "Device and process for improved {a}",
    "Scalable {a} architecture with integrated {b}",
]
ABSTRACT_TEMPLATES = [
    "Disclosed is a {a} approach that combines {b} with {c} to improve accuracy and reduce cost. "
    "The method processes input signals, applies a trained model and outputs actionable results for {d}.",
    "An apparatus and method are provided for {a}. A controller coordinates {b} and {c}, enabling real-time "
    "operation in {d} settings while lowering energy consumption.",
    "Embodiments describe a {a} pipeline in which {b} is coupled to {c}. Experimental results indicate higher "
    "throughput and robustness for applications in {d}.",
]
APPLICATIONS = ["healthcare", "manufacturing", "energy networks", "smart cities", "agriculture", "financial services",
                "logistics", "telecommunications", "environmental monitoring", "consumer electronics"]
FIRST = ["Aarav", "Mei", "Lucas", "Amara", "Sofia", "Kenji", "Priya", "Omar", "Elena", "Tunde", "Hana", "Mateo",
         "Ingrid", "Ravi", "Chloe", "Yusuf", "Anika", "Diego", "Leila", "Noah", "Zara", "Arjun", "Mina", "Felix"]
LAST = ["Sharma", "Chen", "Silva", "Okafor", "Rossi", "Tanaka", "Iyer", "Haddad", "Novak", "Adeyemi", "Kim",
        "Garcia", "Larsen", "Menon", "Dubois", "Demir", "Kapoor", "Alvarez", "Rahimi", "Fischer", "Mensah", "Nair"]
JURISDICTIONS = ["US"] * 5 + ["EP"] * 2 + ["IN"] * 2 + ["CN", "JP", "KR", "WO", "WO"]


def _assignees_for(area: str) -> list[str]:
    return [a for a, areas in ASSIGNEES.items() if area in areas]


def _yearly_counts(area: str, total: int) -> dict[int, int]:
    years = list(range(2012, 2026))
    if GROWTH[area] is None:  # rise-and-fall hype curve (peak 2018-2019)
        weights = [0.3, 0.4, 0.6, 1.0, 1.8, 3.0, 4.2, 4.0, 3.1, 2.4, 2.0, 1.8, 1.7, 1.2]
    else:
        g = GROWTH[area]
        weights = [g ** i for i in range(len(years))]
        weights[-1] *= 0.55  # 2025 is incomplete because of publication lag
    s = sum(weights)
    counts = {y: max(0, round(total * w / s)) for y, w in zip(years, weights)}
    return counts


def generate_patents() -> list[dict]:
    records = []
    for area in taxonomy.areas():
        key = area["key"]
        kws = area["keywords"]
        owners = _assignees_for(key)
        n = 0
        for year, count in _yearly_counts(key, VOLUME[key]).items():
            for _ in range(count):
                n += 1
                a, b, c = RNG.sample(kws, 3)
                title = RNG.choice(TITLE_TEMPLATES).format(a=a, b=b, A=a.capitalize())
                abstract = RNG.choice(ABSTRACT_TEMPLATES).format(a=a, b=b, c=c, d=RNG.choice(APPLICATIONS))
                filing = date(year, RNG.randint(1, 12), RNG.randint(1, 28))
                age = 2026 - year
                # realistic prosecution outcomes: recent filings are mostly pending, older ones are decided
                roll = RNG.random()
                if age >= 6:
                    status = "granted" if roll < 0.78 else "abandoned"
                elif age >= 3:
                    status = "granted" if roll < 0.6 else ("pending" if roll < 0.94 else "abandoned")
                else:
                    status = "granted" if roll < 0.08 else "pending"
                granted = status == "granted"
                grant_date = filing + timedelta(days=RNG.randint(700, 1300)) if granted else None
                if grant_date and grant_date > date(2026, 10, 1):
                    status, grant_date, granted = "pending", None, False
                citations = int(RNG.lognormvariate(0.6, 0.9) * max(1, age) * 0.8)
                inventors = [f"{RNG.choice(FIRST)} {RNG.choice(LAST)}" for _ in range(RNG.randint(1, 4))]
                records.append({
                    "patent_number": f"ILLUS-{key.upper().replace('_', '')[:6]}-{n:04d}",
                    "title": title[0].upper() + title[1:],
                    "abstract": abstract,
                    "assignee": RNG.choice(owners),
                    "inventors": sorted(set(inventors)),
                    "filing_date": filing.isoformat(),
                    "grant_date": grant_date.isoformat() if grant_date else None,
                    "status": status,
                    "classification": RNG.choice(CPC_GROUPS[key]),
                    "technology_domain": key,
                    "citation_count": citations,
                    "jurisdiction": RNG.choice(JURISDICTIONS),
                    "keywords": [a, b, c],
                })
    return records


# (organisation, funder type, eligible countries, applicant types, focus areas) — focus lists are hand-balanced so
# every technology area receives at least three illustrative calls.
FUNDERS = [
    ("Example National Research Council", "research_council", ["India"], ["university", "researcher", "nonprofit"],
     ["ai_ml", "digital_health", "biotech", "climate_tech", "quantum"]),
    ("Sample Science & Engineering Board", "research_council", ["India"], ["university", "researcher"],
     ["computer_vision", "advanced_materials", "semiconductors", "nlp"]),
    ("Example European Research Agency", "international_agency", ["European Union"],
     ["university", "researcher", "nonprofit"], ["quantum", "clean_energy", "robotics", "cybersecurity"]),
    ("Illustrative Global Innovation Fund", "innovation_fund", ["Global"], ["startup", "enterprise", "nonprofit"],
     ["agritech", "climate_tech", "digital_health", "iot_edge"]),
    ("Sample Deep-Tech Accelerator", "startup_accelerator", ["Global"], ["startup"],
     ["ai_ml", "robotics", "semiconductors", "quantum"]),
    ("Example Climate Venture Studio", "venture_program", ["Global"], ["startup"],
     ["clean_energy", "climate_tech", "advanced_materials", "agritech"]),
    ("Demo Health Innovation Challenge", "innovation_fund", ["India", "Kenya", "Bangladesh", "Indonesia"],
     ["startup", "nonprofit", "university"], ["digital_health", "biotech", "nlp", "computer_vision"]),
    ("Example UK Research Programme", "research_council", ["United Kingdom"], ["university", "researcher", "enterprise"],
     ["cybersecurity", "blockchain_fintech", "nlp", "robotics"]),
    ("Sample Asia-Pacific Tech Fund", "venture_program", ["Singapore", "India", "Australia", "Japan"], ["startup"],
     ["iot_edge", "blockchain_fintech", "cybersecurity", "ai_ml"]),
    ("Illustrative Development Agency", "international_agency", ["Global"], ["nonprofit", "university", "government"],
     ["agritech", "clean_energy", "digital_health", "climate_tech"]),
    ("Example State Startup Mission", "government_grant", ["India"], ["startup"],
     ["iot_edge", "agritech", "blockchain_fintech", "computer_vision"]),
    ("Sample Women in STEM Fellowship Trust", "research_council", ["Global"], ["researcher"],
     ["biotech", "advanced_materials", "semiconductors", "ai_ml"]),
]
CALL_TEMPLATES = [
    ("{area} Frontier Research Grants", "Supports ambitious, investigator-led research in {area_l}, including {k1} and {k2}. "
     "Proposals should articulate novelty, methodology and expected scientific impact.", (150000, 600000)),
    ("{area} Translational Innovation Awards", "Funds proof-of-concept and prototype development that moves {k1} research "
     "towards real-world deployment, with emphasis on {k2} and measurable outcomes.", (50000, 250000)),
    ("Seed Programme for {area} Startups", "Equity-free seed support, mentoring and cloud credits for early-stage ventures "
     "building products in {area_l}, such as {k1} or {k2}.", (20000, 100000)),
    ("{area} Industry-Academia Partnership Call", "Co-funded collaborative projects between universities and companies "
     "on {k1} and {k2}; at least one industry partner is required.", (100000, 500000)),
    ("Early-Career Fellowship in {area}", "Two-year fellowships for early-career researchers working on {k1}, {k2} or "
     "related topics in {area_l}.", (40000, 120000)),
    ("{area} Scale-up Challenge", "Competitive challenge for teams with validated pilots in {k1} seeking to scale; "
     "winners receive grant funding and investor introductions.", (100000, 750000)),
]


def generate_funding() -> list[dict]:
    records = []
    idx = 0
    for funder, ftype, countries, applicants, focus in FUNDERS:
        for area in (taxonomy.area_by_key(k) for k in focus):
            templates = CALL_TEMPLATES
            if ftype in ("startup_accelerator", "venture_program"):
                templates = [CALL_TEMPLATES[2], CALL_TEMPLATES[5]]
            elif ftype == "research_council":
                templates = [CALL_TEMPLATES[0], CALL_TEMPLATES[4], CALL_TEMPLATES[3]]
            title_t, desc_t, (lo, hi) = RNG.choice(templates)
            k1, k2 = RNG.sample(area["keywords"], 2)
            short = area["name"].split(" & ")[0]
            career = ["early_career"] if "Fellowship" in title_t else []
            if "Women in STEM" in funder:
                career = ["student", "early_career", "mid_career"]
            idx += 1
            in_days = RNG.choice([None] + list(range(5, 200, 7)))
            records.append({
                "key": f"illus-funding-{idx:03d}",
                "title": title_t.format(area=short),
                "organization": funder,
                "funder_type": ftype,
                "description": desc_t.format(area_l=area["name"].lower(), k1=k1, k2=k2) +
                " (Illustrative sample record generated for demonstration — not a real funding call.)",
                "domains": [area["key"]],
                "keywords": [k1, k2],
                "eligibility_text": f"Open to {', '.join(applicants)} applicants based in {', '.join(countries)}."
                                    + (" Early-career researchers only." if career == ["early_career"] else ""),
                "applicant_types": applicants,
                "eligible_countries": countries,
                "career_stages": career,
                "min_amount": float(lo),
                "max_amount": float(hi),
                "currency": "USD",
                "deadline_in_days": in_days,
                "opened_days_ago": RNG.randint(5, 90),
                "status": "rolling" if in_days is None else "open",
            })
    return records


def main() -> None:
    data_dir = get_settings().data_path
    patents = generate_patents()
    (data_dir / "patents_illustrative.json").write_text(json.dumps({
        "notice": "ILLUSTRATIVE SYNTHETIC DATA. Patent numbers (ILLUS-*), assignees, inventors, titles and citation "
                  "counts are generated for demonstration only and do not refer to real patents. CPC codes are real "
                  "classification groups used as labels.",
        "generator": "backend/scripts/generate_illustrative_data.py (seed 2026)",
        "count": len(patents), "records": patents}, indent=1), encoding="utf-8")
    funding = generate_funding()
    (data_dir / "funding_illustrative.json").write_text(json.dumps({
        "notice": "ILLUSTRATIVE SYNTHETIC DATA. Organisations, programmes and amounts are invented for demonstration "
                  "and are not real funding opportunities. Deadlines are offsets resolved when the database is seeded.",
        "generator": "backend/scripts/generate_illustrative_data.py (seed 2026)",
        "count": len(funding), "records": funding}, indent=1), encoding="utf-8")
    print(f"patents: {len(patents)}, funding: {len(funding)}")


if __name__ == "__main__":
    main()
