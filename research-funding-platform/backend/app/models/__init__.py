"""Import every model so that Base.metadata is complete (used by Alembic and tests)."""
from app.models.funding import FundingOpportunity, RecommendationFeedback, RecommendationLog, SavedFunding
from app.models.innovation import InnovationProject, InnovationScore
from app.models.research import Patent, Publication, TrendPoint
from app.models.system import AuditLog, DatasetImport, JobRun, Notification, ReportRecord
from app.models.user import ROLES, ResearchHistoryEntry, ResearchProfile, User

__all__ = [
    "ROLES", "User", "ResearchProfile", "ResearchHistoryEntry", "Publication", "Patent", "TrendPoint",
    "FundingOpportunity", "SavedFunding", "RecommendationLog", "RecommendationFeedback",
    "InnovationProject", "InnovationScore", "Notification", "AuditLog", "DatasetImport", "ReportRecord", "JobRun",
]
