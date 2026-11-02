"""Report generation and export (CSV, Excel via openpyxl, PDF via ReportLab)."""
from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone

import pandas as pd
from fastapi import HTTPException, status
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import taxonomy
from app.models import FundingOpportunity, Patent, User
from app.services import commercialization, innovation_service, patent_analytics, recommender, research_analytics, scoring

REPORT_TYPES = {
    "funding": ("Funding Opportunities Report", "Personalised recommendations plus the active funding catalogue with "
                "eligibility, deadlines and source attribution.", ["domain"]),
    "patents": ("Patent Landscape Report", "Patent records, top assignees and filing trends (optionally for one "
                "technology domain).", ["domain"]),
    "research_trends": ("Research Trends Report", "Publication growth per technology area, emerging topics and "
                        "research hotspots.", ["domain"]),
    "innovation": ("Innovation Intelligence Report", "Innovation projects with the weighted score breakdown "
                   "(portfolio-wide for innovation managers and administrators).", []),
    "commercialization": ("Commercialization Report", "Commercialization pathway fit, risks and next steps for "
                          "one project (or an overview of all your projects).", ["project_id"]),
}
MAX_PDF_ROWS = 60


@dataclass
class ReportData:
    title: str
    summary: list[tuple[str, str]]
    frame: pd.DataFrame
    notes: list[str] = field(default_factory=list)
    extra_sheets: dict[str, pd.DataFrame] = field(default_factory=dict)


def types_payload() -> list[dict]:
    return [{"key": k, "title": t, "description": d, "formats": ["csv", "xlsx", "pdf"], "params": p}
            for k, (t, d, p) in REPORT_TYPES.items()]


def _funding(db: Session, user: User, domain: str | None) -> ReportData:
    recs = recommender.recommend(db, user, limit=25, include_ineligible=True)["items"]
    rec_rows = [{"Title": r["funding"]["title"], "Organization": r["funding"]["organization"],
                 "Match score": r["match_score"], "Eligibility": r["eligibility"]["status"],
                 "Deadline": r["funding"]["deadline"] or "Rolling/TBA",
                 "Max amount": r["funding"]["max_amount"], "Currency": r["funding"]["currency"],
                 "Record type": r["funding"]["record_type"], "Source": r["funding"]["source_url"] or "Illustrative"}
                for r in recs if not domain or domain in r["funding"]["domains"]]
    stmt = select(FundingOpportunity).where(FundingOpportunity.status.in_(recommender.ACTIVE_STATUSES))
    catalogue = [f for f in db.execute(stmt.order_by(FundingOpportunity.deadline.asc().nulls_last())).scalars()
                 if not domain or domain in (f.domains or [])]
    cat = pd.DataFrame([{
        "Title": f.title, "Organization": f.organization, "Funder type": taxonomy.FUNDER_TYPES.get(f.funder_type),
        "Domains": ", ".join(taxonomy.area_name(d) for d in f.domains or []), "Status": f.status,
        "Deadline": f.deadline.isoformat() if f.deadline else "Rolling/TBA", "Max amount": f.max_amount,
        "Currency": f.currency, "Countries": ", ".join(f.eligible_countries or []), "Record type": f.record_type,
        "Source URL": f.source_url or "", "Verified at": f.verified_at.date().isoformat() if f.verified_at else "",
    } for f in catalogue])
    verified = sum(1 for f in catalogue if f.record_type == "verified")
    return ReportData(
        title=REPORT_TYPES["funding"][0] + (f" — {taxonomy.area_name(domain)}" if domain else ""),
        summary=[("Recommended opportunities", str(len(rec_rows))), ("Active opportunities", str(len(catalogue))),
                 ("Verified (official source)", str(verified)), ("Illustrative samples", str(len(catalogue) - verified))],
        frame=pd.DataFrame(rec_rows), extra_sheets={"Catalogue": cat},
        notes=["Match scores combine TF-IDF similarity, domain overlap and eligibility rules.",
               "Illustrative records are synthetic demo data and not real calls; verify deadlines at the source."])


def _patents(db: Session, user: User, domain: str | None) -> ReportData:
    stmt = select(Patent).where(Patent.owner_id.is_(None))
    if domain:
        stmt = stmt.where(Patent.technology_domain == domain)
    rows = db.execute(stmt.order_by(Patent.filing_date.desc().nulls_last())).scalars().all()
    frame = pd.DataFrame([{
        "Patent number": p.patent_number, "Title": p.title, "Assignee": p.assignee,
        "Filing date": p.filing_date.isoformat() if p.filing_date else "", "Status": p.status,
        "Classification": p.classification, "Domain": taxonomy.area_name(p.technology_domain),
        "Citations": p.citation_count, "Jurisdiction": p.jurisdiction, "Record type": p.record_type,
    } for p in rows])
    top = patent_analytics.assignees(db, domain, 10)["items"]
    assignee_df = pd.DataFrame([{"Assignee": a["assignee"], "Patents": a["patents"], "Citations": a["citations"],
                                 "Top domain": a["top_domain"]} for a in top])
    illus = sum(1 for p in rows if p.record_type == "illustrative")
    return ReportData(
        title=REPORT_TYPES["patents"][0] + (f" — {taxonomy.area_name(domain)}" if domain else ""),
        summary=[("Patents", str(len(rows))), ("Assignees", str(len({p.assignee for p in rows}))),
                 ("Total citations", str(sum(p.citation_count or 0 for p in rows))),
                 ("Illustrative records", str(illus))],
        frame=frame, extra_sheets={"Top assignees": assignee_df},
        notes=["Illustrative patents are synthetic demo records (ILLUS-* numbers) unless real data was imported."])


def _research(db: Session, user: User, domain: str | None) -> ReportData:
    growth = research_analytics.growth_table(db)
    if domain:
        growth = [g for g in growth if g["domain"] == domain]
    frame = pd.DataFrame([{"Technology area": g["name"], "5-yr CAGR %": g["cagr"], "Total works": g["total"],
                           "Last 5 years": g["recent"], "Trend": g["trend"]} for g in growth])
    topics = research_analytics.emerging_topics(db, domain, 20)["items"]
    topics_df = pd.DataFrame([{"Term": t["term"], "Recent docs": t["recent_count"], "Previous docs": t["previous_count"],
                               "Growth %": t["growth_rate"], "Domains": ", ".join(t["domains"])} for t in topics])
    hot = research_analytics.hotspots(db, 8)["items"]
    hot_df = pd.DataFrame([{"Hotspot": h["label"], "Size": h["size"], "Avg citations": h["avg_citations"],
                            "Recent share": h["recent_share"], "Score": h["hotspot_score"]} for h in hot])
    ov = research_analytics.overview(db)
    return ReportData(
        title=REPORT_TYPES["research_trends"][0] + (f" — {taxonomy.area_name(domain)}" if domain else ""),
        summary=[("Publications in corpus", str(ov["total_publications"])),
                 ("Total citations", str(ov["total_citations"])),
                 ("Fastest-growing area", growth[0]["name"] if growth else "n/a"),
                 ("Emerging topics listed", str(len(topics)))],
        frame=frame, extra_sheets={"Emerging topics": topics_df, "Hotspots": hot_df},
        notes=["Publication growth is based on OpenAlex yearly counts (CC0) captured in the data snapshot."])


def _innovation(db: Session, user: User, domain: str | None) -> ReportData:
    port = innovation_service.portfolio(db, user)
    projects = innovation_service.visible_projects(db, user, "all")
    rows = []
    for p in projects:
        s = p.latest_score
        rows.append({"Project": p.title, "Owner": p.owner.full_name if p.owner else "", "Domain": taxonomy.area_name(p.domain),
                     "Stage": p.stage, "TRL": p.trl, "Innovation score": s.overall if s else None,
                     "Band": s.band if s else "Not scored",
                     "Research novelty": s.research_novelty if s else None, "Patent strength": s.patent_strength if s else None,
                     "Technology maturity": s.technology_maturity if s else None,
                     "Market potential": s.market_potential if s else None,
                     "Funding relevance": s.funding_relevance if s else None})
    return ReportData(
        title=REPORT_TYPES["innovation"][0],
        summary=[("Projects", str(port["projects_count"])), ("Scored", str(port["scored_count"])),
                 ("Average score", str(port["avg_score"] if port["avg_score"] is not None else "n/a")),
                 ("Formula", "0.30 N + 0.20 P + 0.15 T + 0.20 M + 0.15 F")],
        frame=pd.DataFrame(rows), notes=[scoring.DISCLAIMER])


def _commercial(db: Session, user: User, project_id: int | None) -> ReportData:
    if project_id:
        project = innovation_service.get_project(db, project_id, user)
        res = commercialization.analyse(db, project, user)
        frame = pd.DataFrame([{"Pathway": p["title"], "Fit score": p["fit_score"], "Recommended": p["recommended"],
                               "Rationale": "; ".join(p["rationale"]), "Next steps": "; ".join(p["next_steps"])}
                              for p in res["pathways"]])
        return ReportData(
            title=f"Commercialization Report — {project.title}",
            summary=[("Innovation score", f"{res['score']['overall']} ({res['score']['band']})"),
                     ("Top pathway", res["pathways"][0]["title"]),
                     ("Licensing targets", ", ".join(t["assignee"] for t in res["licensing_targets"][:3]) or "n/a"),
                     ("Key risks", str(len(res["risks"])))],
            frame=frame, extra_sheets={"Risks": pd.DataFrame({"Risk": res["risks"]})},
            notes=[res["summary"], scoring.DISCLAIMER])
    projects = innovation_service.visible_projects(db, user, "all")
    ov = commercialization.overview(db, projects)["items"]
    frame = pd.DataFrame([{"Project": i["title"], "Innovation score": i["overall"], "Band": i["band"],
                           "Top pathway": i["top_pathway_title"], "Fit score": i["fit_score"]} for i in ov])
    return ReportData(title="Commercialization Overview", summary=[("Projects", str(len(ov)))], frame=frame,
                      notes=[scoring.DISCLAIMER])


def build(db: Session, user: User, report_type: str, domain: str | None = None, project_id: int | None = None) -> ReportData:
    if report_type not in REPORT_TYPES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown report type '{report_type}'")
    if domain and domain not in taxonomy.area_keys():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown domain")
    if report_type == "funding":
        return _funding(db, user, domain)
    if report_type == "patents":
        return _patents(db, user, domain)
    if report_type == "research_trends":
        return _research(db, user, domain)
    if report_type == "innovation":
        return _innovation(db, user, domain)
    return _commercial(db, user, project_id)


def preview(data: ReportData, max_rows: int = 20) -> dict:
    df = data.frame.astype(object).where(pd.notna(data.frame), None) if not data.frame.empty else data.frame
    return {"title": data.title, "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "summary": [{"label": k, "value": v} for k, v in data.summary],
            "columns": list(df.columns), "rows": df.head(max_rows).values.tolist(), "total_rows": int(len(df)),
            "notes": data.notes}


def filename(data: ReportData, fmt: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", data.title.lower()).strip("-")[:60]
    return f"{slug}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M')}.{fmt}"


def to_csv(data: ReportData) -> bytes:
    return data.frame.to_csv(index=False).encode("utf-8-sig")


def to_xlsx(data: ReportData) -> bytes:
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        summary = pd.DataFrame([{"Item": k, "Value": v} for k, v in data.summary] +
                               [{"Item": "Generated (UTC)", "Value": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")}] +
                               [{"Item": "Note", "Value": n} for n in data.notes])
        summary.to_excel(writer, sheet_name="Summary", index=False)
        data.frame.to_excel(writer, sheet_name="Data", index=False)
        for name, frame in data.extra_sheets.items():
            frame.to_excel(writer, sheet_name=name[:31], index=False)
        for ws in writer.book.worksheets:
            for column in ws.columns:
                width = max((len(str(c.value)) for c in column if c.value is not None), default=8)
                ws.column_dimensions[column[0].column_letter].width = min(60, max(10, width + 2))
            ws.freeze_panes = "A2"
    return buffer.getvalue()


def to_pdf(data: ReportData) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4), leftMargin=12 * mm, rightMargin=12 * mm,
                            topMargin=12 * mm, bottomMargin=12 * mm, title=data.title)
    styles = getSampleStyleSheet()
    cell = ParagraphStyle("cell", parent=styles["BodyText"], fontSize=7, leading=8.5)
    head = ParagraphStyle("head", parent=cell, textColor=colors.white, fontName="Helvetica-Bold")
    story = [Paragraph(data.title, styles["Title"]),
             Paragraph(f"Research Funding &amp; Innovation Intelligence Platform — generated "
                       f"{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')} UTC", styles["Normal"]),
             Spacer(1, 6 * mm)]
    summary = Table([[Paragraph(f"<b>{k}</b>", cell), Paragraph(str(v), cell)] for k, v in data.summary],
                    colWidths=[60 * mm, 150 * mm])
    summary.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#CBD5E1")),
                                 ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#EEF2FF"))]))
    story += [summary, Spacer(1, 6 * mm)]
    if not data.frame.empty:
        df = data.frame.head(MAX_PDF_ROWS).fillna("")
        cols = list(df.columns)
        table_data = [[Paragraph(str(c), head) for c in cols]]
        for row in df.itertuples(index=False):
            table_data.append([Paragraph(str(v)[:300].replace("&", "&amp;").replace("<", "&lt;"), cell) for v in row])
        width = (landscape(A4)[0] - 24 * mm) / len(cols)
        table = Table(table_data, colWidths=[width] * len(cols), repeatRows=1)
        table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4F46E5")),
                                   ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CBD5E1")),
                                   ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                                   ("VALIGN", (0, 0), (-1, -1), "TOP")]))
        story.append(table)
        if len(data.frame) > MAX_PDF_ROWS:
            story.append(Paragraph(f"Showing first {MAX_PDF_ROWS} of {len(data.frame)} rows — export Excel/CSV for all rows.",
                                   styles["Italic"]))
    else:
        story.append(Paragraph("No rows for the selected filters.", styles["Italic"]))
    story.append(Spacer(1, 4 * mm))
    for note in data.notes:
        story.append(Paragraph(f"Note: {note}", ParagraphStyle("note", parent=styles["Normal"], fontSize=7,
                                                               textColor=colors.HexColor("#475569"))))
    doc.build(story)
    return buffer.getvalue()


MEDIA_TYPES = {"csv": "text/csv; charset=utf-8",
               "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
               "pdf": "application/pdf"}


def render(data: ReportData, fmt: str) -> bytes:
    if fmt == "csv":
        return to_csv(data)
    if fmt == "xlsx":
        return to_xlsx(data)
    if fmt == "pdf":
        return to_pdf(data)
    raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "format must be csv, xlsx or pdf")
