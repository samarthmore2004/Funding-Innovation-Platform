"""Text utilities shared by the recommender, scoring and analytics modules (scikit-learn TF-IDF)."""
from __future__ import annotations

import re

import numpy as np
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, TfidfVectorizer

from app.core import taxonomy

# Generic grant/research boilerplate that would otherwise dominate similarity scores.
DOMAIN_STOP_WORDS = {
    "research", "program", "programme", "funding", "fund", "grant", "grants", "award", "awards", "project", "projects",
    "proposal", "proposals", "applicant", "applicants", "application", "applications", "eligible", "eligibility",
    "support", "supports", "new", "including", "include", "use", "used", "using", "based", "provide", "provides",
    "opportunity", "opportunities", "agency", "federal", "national", "office", "year", "years", "nsf", "nih",
    "submission", "submit", "solicitation", "announcement", "notice", "foa", "nofo", "description", "information",
    "sample", "illustrative", "demo", "study", "studies", "paper", "approach", "results", "propose", "proposed",
    "work", "develop", "development", "developing", "technology", "technologies", "innovation", "innovative",
    # disclaimer wording on illustrative records must never count as topical overlap
    "record", "records", "generated", "demonstration", "call", "calls",
}
# Generic academic vocabulary that carries no topical signal (keeps emerging-topic lists meaningful).
GENERIC_ACADEMIC = {
    "abstract", "universal", "widespread", "challenge", "challenges", "future", "novel", "recent", "recently", "review",
    "survey", "state", "art", "existing", "various", "different", "potential", "significant", "significantly", "key",
    "important", "current", "currently", "emerging", "lead", "leading", "high", "low", "rapid", "rapidly", "growing",
    "increasing", "increasingly", "improve", "improved", "improving", "performance", "application", "applications",
    "field", "fields", "area", "areas", "address", "despite", "however", "remain", "remains", "need", "needs",
    "present", "presents", "discuss", "discussed", "highlight", "highlights", "comprehensive", "overview", "insights",
    "perspective", "perspectives", "framework", "method", "methods", "analysis", "results", "result", "show", "shows",
    "shown", "demonstrate", "demonstrates", "paper", "article", "aim", "aims", "explore", "explores", "including",
    "particular", "particularly", "e.g", "i.e", "et", "al", "use", "uses", "wide", "range", "large", "small",
    "level", "levels", "role", "impact", "impacts", "effect", "effects", "effective", "effectively", "efficient",
    "efficiency", "provides", "provided", "offer", "offers", "approaches", "related", "specific", "general", "overall",
    "accurate", "achieved", "achieve", "achieves", "achieving", "limits", "limited", "versatile", "lives", "world",
    "human", "humans", "computational", "structure", "structures", "architecture", "architectures", "prediction",
    "predictions", "code", "device", "devices", "able", "enable", "enables", "make", "makes", "new", "way", "ways",
}
# Patent boilerplate (claims/abstract language) that would otherwise dominate patent clustering.
PATENT_BOILERPLATE = {
    "apparatus", "method", "methods", "system", "systems", "device", "devices", "process", "embodiment",
    "embodiments", "disclosed", "discloses", "comprising", "comprises", "configured", "plurality", "wherein", "said",
    "invention", "provided", "describe", "describes", "platform", "employing", "scalable", "architecture",
    "integrated", "adaptive", "improved", "approach", "combines", "accuracy", "reduce", "cost", "processes", "input",
    "signals", "applies", "trained", "outputs", "actionable", "controller", "coordinates", "enabling", "real-time",
    "operation", "settings", "lowering", "consumption", "pipeline", "coupled", "experimental", "indicate", "higher",
    "throughput", "robustness", "real", "time",
}
STOP_WORDS = list(ENGLISH_STOP_WORDS.union(DOMAIN_STOP_WORDS).union(GENERIC_ACADEMIC))
TOKEN_PATTERN = r"(?u)\b[a-zA-Z][a-zA-Z0-9\-]{1,}\b"


def make_vectorizer(max_features: int | None = 20000, min_df: int = 1,
                    extra_stop_words: set[str] | None = None) -> TfidfVectorizer:
    stop = STOP_WORDS if not extra_stop_words else list(set(STOP_WORDS).union(extra_stop_words))
    return TfidfVectorizer(stop_words=stop, ngram_range=(1, 2), sublinear_tf=True, min_df=min_df,
                           max_features=max_features, token_pattern=TOKEN_PATTERN, strip_accents="unicode")


def clean(text: str | None) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def domain_expansion(domain_keys: list[str] | None) -> str:
    """Expand taxonomy keys into their descriptive keywords so they contribute to text similarity.
    Used on the *query* side only (profile/project), so identical expansions never inflate similarity."""
    parts = []
    for key in domain_keys or []:
        area = taxonomy.area_by_key(key)
        if area:
            parts.append(area["name"])
            parts.append(" ".join(area["keywords"]))
    return " ".join(parts)


def domain_names(domain_keys: list[str] | None) -> str:
    return " ".join(taxonomy.area_name(k) for k in domain_keys or [] if taxonomy.area_by_key(k))


def shared_terms(vec_a, vec_b, feature_names: np.ndarray, top_n: int = 6) -> list[str]:
    """Terms contributing most to the cosine similarity of two sparse TF-IDF row vectors."""
    a = vec_a.toarray().ravel() if hasattr(vec_a, "toarray") else np.asarray(vec_a).ravel()
    b = vec_b.toarray().ravel() if hasattr(vec_b, "toarray") else np.asarray(vec_b).ravel()
    contrib = a * b
    idx = np.argsort(contrib)[::-1]
    terms: list[str] = []
    for i in idx[: top_n * 3]:
        if contrib[i] <= 0:
            break
        term = feature_names[i]
        # skip unigrams already covered by a selected bigram
        if any(term in t.split() for t in terms if " " in t):
            continue
        terms.append(term)
        if len(terms) >= top_n:
            break
    return terms


def top_terms(vec, feature_names: np.ndarray, top_n: int = 10) -> list[str]:
    arr = vec.toarray().ravel() if hasattr(vec, "toarray") else np.asarray(vec).ravel()
    idx = np.argsort(arr)[::-1][:top_n]
    return [feature_names[i] for i in idx if arr[i] > 0]
