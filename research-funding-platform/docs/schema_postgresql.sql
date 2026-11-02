-- PostgreSQL DDL generated offline from Alembic revision 0001 (alembic upgrade head --sql)
-- Regenerate: set DATABASE_URL=postgresql+psycopg://user:pass@host/db, then: alembic upgrade head --sql
BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 0001

CREATE TABLE job_runs (
    id SERIAL NOT NULL, 
    name VARCHAR(64) NOT NULL, 
    status VARCHAR(16) NOT NULL, 
    detail TEXT, 
    trigger VARCHAR(16) NOT NULL, 
    started_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    finished_at TIMESTAMP WITHOUT TIME ZONE, 
    CONSTRAINT pk_job_runs PRIMARY KEY (id)
);

CREATE INDEX ix_job_runs_name ON job_runs (name);

CREATE INDEX ix_job_runs_started_at ON job_runs (started_at);

CREATE TABLE publication_trend_points (
    id SERIAL NOT NULL, 
    area_key VARCHAR(64) NOT NULL, 
    year INTEGER NOT NULL, 
    count INTEGER NOT NULL, 
    source VARCHAR(64) NOT NULL, 
    retrieved_at TIMESTAMP WITHOUT TIME ZONE, 
    CONSTRAINT pk_publication_trend_points PRIMARY KEY (id), 
    CONSTRAINT uq_trend_area_year_source UNIQUE (area_key, year, source)
);

CREATE INDEX ix_publication_trend_points_area_key ON publication_trend_points (area_key);

CREATE TABLE users (
    id SERIAL NOT NULL, 
    email VARCHAR(255) NOT NULL, 
    full_name VARCHAR(200) NOT NULL, 
    hashed_password VARCHAR(255), 
    role VARCHAR(32) NOT NULL, 
    organization VARCHAR(255), 
    is_active BOOLEAN NOT NULL, 
    auth_provider VARCHAR(32) NOT NULL, 
    notification_preferences JSON NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    last_login_at TIMESTAMP WITHOUT TIME ZONE, 
    CONSTRAINT pk_users PRIMARY KEY (id)
);

CREATE INDEX ix_users_created_at ON users (created_at);

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE INDEX ix_users_role ON users (role);

CREATE TABLE audit_logs (
    id SERIAL NOT NULL, 
    user_id INTEGER, 
    user_email VARCHAR(255), 
    action VARCHAR(64) NOT NULL, 
    entity_type VARCHAR(64), 
    entity_id VARCHAR(64), 
    detail TEXT, 
    ip_address VARCHAR(64), 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    CONSTRAINT pk_audit_logs PRIMARY KEY (id), 
    CONSTRAINT fk_audit_logs_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_audit_logs_action ON audit_logs (action);

CREATE INDEX ix_audit_logs_created_at ON audit_logs (created_at);

CREATE INDEX ix_audit_logs_user_id ON audit_logs (user_id);

CREATE TABLE dataset_imports (
    id SERIAL NOT NULL, 
    dataset VARCHAR(32) NOT NULL, 
    filename VARCHAR(300), 
    source VARCHAR(64) NOT NULL, 
    status VARCHAR(16) NOT NULL, 
    rows_total INTEGER NOT NULL, 
    rows_imported INTEGER NOT NULL, 
    rows_failed INTEGER NOT NULL, 
    errors JSON NOT NULL, 
    user_id INTEGER, 
    user_email VARCHAR(255), 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    CONSTRAINT pk_dataset_imports PRIMARY KEY (id), 
    CONSTRAINT fk_dataset_imports_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_dataset_imports_created_at ON dataset_imports (created_at);

CREATE INDEX ix_dataset_imports_dataset ON dataset_imports (dataset);

CREATE TABLE funding_opportunities (
    id SERIAL NOT NULL, 
    title VARCHAR(500) NOT NULL, 
    organization VARCHAR(300) NOT NULL, 
    funder_type VARCHAR(48) NOT NULL, 
    description TEXT NOT NULL, 
    domains JSON NOT NULL, 
    keywords JSON NOT NULL, 
    eligibility_text TEXT, 
    applicant_types JSON NOT NULL, 
    eligible_countries JSON NOT NULL, 
    career_stages JSON NOT NULL, 
    min_amount FLOAT, 
    max_amount FLOAT, 
    currency VARCHAR(8) NOT NULL, 
    open_date DATE, 
    deadline DATE, 
    status VARCHAR(24) NOT NULL, 
    source_name VARCHAR(200), 
    source_url VARCHAR(1000), 
    record_type VARCHAR(24) NOT NULL, 
    verified_at TIMESTAMP WITHOUT TIME ZONE, 
    external_id VARCHAR(255), 
    created_by_id INTEGER, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    CONSTRAINT pk_funding_opportunities PRIMARY KEY (id), 
    CONSTRAINT fk_funding_opportunities_created_by_id_users FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL, 
    CONSTRAINT uq_funding_opportunities_external_id UNIQUE (external_id)
);

CREATE INDEX ix_funding_opportunities_created_at ON funding_opportunities (created_at);

CREATE INDEX ix_funding_opportunities_deadline ON funding_opportunities (deadline);

CREATE INDEX ix_funding_opportunities_funder_type ON funding_opportunities (funder_type);

CREATE INDEX ix_funding_opportunities_organization ON funding_opportunities (organization);

CREATE INDEX ix_funding_opportunities_record_type ON funding_opportunities (record_type);

CREATE INDEX ix_funding_opportunities_status ON funding_opportunities (status);

CREATE TABLE innovation_projects (
    id SERIAL NOT NULL, 
    owner_id INTEGER NOT NULL, 
    title VARCHAR(300) NOT NULL, 
    description TEXT NOT NULL, 
    domain VARCHAR(64), 
    keywords JSON NOT NULL, 
    stage VARCHAR(24) NOT NULL, 
    trl INTEGER NOT NULL, 
    market_size VARCHAR(24) NOT NULL, 
    target_market VARCHAR(300), 
    patents_filed INTEGER NOT NULL, 
    patents_granted INTEGER NOT NULL, 
    team_size INTEGER, 
    has_industry_partner BOOLEAN NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    CONSTRAINT pk_innovation_projects PRIMARY KEY (id), 
    CONSTRAINT fk_innovation_projects_owner_id_users FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_innovation_projects_domain ON innovation_projects (domain);

CREATE INDEX ix_innovation_projects_owner_id ON innovation_projects (owner_id);

CREATE INDEX ix_innovation_projects_stage ON innovation_projects (stage);

CREATE TABLE notifications (
    id SERIAL NOT NULL, 
    user_id INTEGER NOT NULL, 
    type VARCHAR(32) NOT NULL, 
    title VARCHAR(300) NOT NULL, 
    message TEXT NOT NULL, 
    link VARCHAR(500), 
    priority VARCHAR(16) NOT NULL, 
    is_read BOOLEAN NOT NULL, 
    dedupe_key VARCHAR(255), 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    CONSTRAINT pk_notifications PRIMARY KEY (id), 
    CONSTRAINT fk_notifications_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_notification_user_dedupe UNIQUE (user_id, dedupe_key)
);

CREATE INDEX ix_notifications_created_at ON notifications (created_at);

CREATE INDEX ix_notifications_is_read ON notifications (is_read);

CREATE INDEX ix_notifications_type ON notifications (type);

CREATE INDEX ix_notifications_user_id ON notifications (user_id);

CREATE TABLE patents (
    id SERIAL NOT NULL, 
    owner_id INTEGER, 
    patent_number VARCHAR(64), 
    title VARCHAR(500) NOT NULL, 
    abstract TEXT, 
    assignee VARCHAR(255), 
    inventors JSON NOT NULL, 
    filing_date DATE, 
    grant_date DATE, 
    status VARCHAR(32) NOT NULL, 
    classification VARCHAR(64), 
    technology_domain VARCHAR(64), 
    citation_count INTEGER NOT NULL, 
    jurisdiction VARCHAR(16), 
    keywords JSON NOT NULL, 
    source VARCHAR(64) NOT NULL, 
    record_type VARCHAR(32) NOT NULL, 
    url VARCHAR(500), 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    CONSTRAINT pk_patents PRIMARY KEY (id), 
    CONSTRAINT fk_patents_owner_id_users FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_patents_assignee ON patents (assignee);

CREATE INDEX ix_patents_classification ON patents (classification);

CREATE INDEX ix_patents_filing_date ON patents (filing_date);

CREATE INDEX ix_patents_owner_id ON patents (owner_id);

CREATE INDEX ix_patents_patent_number ON patents (patent_number);

CREATE INDEX ix_patents_record_type ON patents (record_type);

CREATE INDEX ix_patents_technology_domain ON patents (technology_domain);

CREATE TABLE publications (
    id SERIAL NOT NULL, 
    owner_id INTEGER, 
    title VARCHAR(500) NOT NULL, 
    abstract TEXT, 
    authors JSON NOT NULL, 
    venue VARCHAR(300), 
    year INTEGER, 
    publication_date DATE, 
    doi VARCHAR(255), 
    url VARCHAR(500), 
    citation_count INTEGER NOT NULL, 
    domain VARCHAR(64), 
    keywords JSON NOT NULL, 
    pub_type VARCHAR(64), 
    source VARCHAR(32) NOT NULL, 
    external_id VARCHAR(255), 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    CONSTRAINT pk_publications PRIMARY KEY (id), 
    CONSTRAINT fk_publications_owner_id_users FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_publications_doi ON publications (doi);

CREATE INDEX ix_publications_domain ON publications (domain);

CREATE INDEX ix_publications_external_id ON publications (external_id);

CREATE INDEX ix_publications_owner_id ON publications (owner_id);

CREATE INDEX ix_publications_source ON publications (source);

CREATE INDEX ix_publications_year ON publications (year);

CREATE TABLE report_records (
    id SERIAL NOT NULL, 
    user_id INTEGER, 
    report_type VARCHAR(32) NOT NULL, 
    format VARCHAR(8) NOT NULL, 
    filename VARCHAR(300) NOT NULL, 
    row_count INTEGER NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    CONSTRAINT pk_report_records PRIMARY KEY (id), 
    CONSTRAINT fk_report_records_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_report_records_created_at ON report_records (created_at);

CREATE INDEX ix_report_records_report_type ON report_records (report_type);

CREATE INDEX ix_report_records_user_id ON report_records (user_id);

CREATE TABLE research_history (
    id SERIAL NOT NULL, 
    user_id INTEGER NOT NULL, 
    kind VARCHAR(32) NOT NULL, 
    title VARCHAR(300) NOT NULL, 
    role VARCHAR(200), 
    institution VARCHAR(300), 
    start_year INTEGER, 
    end_year INTEGER, 
    description TEXT, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    CONSTRAINT pk_research_history PRIMARY KEY (id), 
    CONSTRAINT fk_research_history_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_research_history_user_id ON research_history (user_id);

CREATE TABLE research_profiles (
    id SERIAL NOT NULL, 
    user_id INTEGER NOT NULL, 
    headline VARCHAR(255), 
    bio TEXT, 
    department VARCHAR(255), 
    organization_name VARCHAR(255), 
    organization_type VARCHAR(32), 
    country VARCHAR(100), 
    career_stage VARCHAR(32), 
    research_domains JSON NOT NULL, 
    keywords JSON NOT NULL, 
    technology_areas JSON NOT NULL, 
    orcid VARCHAR(50), 
    website VARCHAR(500), 
    google_scholar_url VARCHAR(500), 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    CONSTRAINT pk_research_profiles PRIMARY KEY (id), 
    CONSTRAINT fk_research_profiles_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX ix_research_profiles_user_id ON research_profiles (user_id);

CREATE TABLE innovation_scores (
    id SERIAL NOT NULL, 
    project_id INTEGER NOT NULL, 
    computed_by_id INTEGER, 
    overall FLOAT NOT NULL, 
    band VARCHAR(24) NOT NULL, 
    research_novelty FLOAT NOT NULL, 
    patent_strength FLOAT NOT NULL, 
    technology_maturity FLOAT NOT NULL, 
    market_potential FLOAT NOT NULL, 
    funding_relevance FLOAT NOT NULL, 
    details JSON NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    CONSTRAINT pk_innovation_scores PRIMARY KEY (id), 
    CONSTRAINT fk_innovation_scores_computed_by_id_users FOREIGN KEY(computed_by_id) REFERENCES users (id) ON DELETE SET NULL, 
    CONSTRAINT fk_innovation_scores_project_id_innovation_projects FOREIGN KEY(project_id) REFERENCES innovation_projects (id) ON DELETE CASCADE
);

CREATE INDEX ix_innovation_scores_created_at ON innovation_scores (created_at);

CREATE INDEX ix_innovation_scores_project_id ON innovation_scores (project_id);

CREATE TABLE recommendation_feedback (
    id SERIAL NOT NULL, 
    user_id INTEGER NOT NULL, 
    funding_id INTEGER NOT NULL, 
    action VARCHAR(16) NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    CONSTRAINT pk_recommendation_feedback PRIMARY KEY (id), 
    CONSTRAINT fk_recommendation_feedback_funding_id_funding_opportunities FOREIGN KEY(funding_id) REFERENCES funding_opportunities (id) ON DELETE CASCADE, 
    CONSTRAINT fk_recommendation_feedback_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_recommendation_feedback_funding_id ON recommendation_feedback (funding_id);

CREATE INDEX ix_recommendation_feedback_user_id ON recommendation_feedback (user_id);

CREATE TABLE recommendation_logs (
    id SERIAL NOT NULL, 
    user_id INTEGER NOT NULL, 
    funding_id INTEGER NOT NULL, 
    match_score FLOAT NOT NULL, 
    similarity FLOAT NOT NULL, 
    eligibility_status VARCHAR(24) NOT NULL, 
    context VARCHAR(32) NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    CONSTRAINT pk_recommendation_logs PRIMARY KEY (id), 
    CONSTRAINT fk_recommendation_logs_funding_id_funding_opportunities FOREIGN KEY(funding_id) REFERENCES funding_opportunities (id) ON DELETE CASCADE, 
    CONSTRAINT fk_recommendation_logs_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_recommendation_logs_created_at ON recommendation_logs (created_at);

CREATE INDEX ix_recommendation_logs_funding_id ON recommendation_logs (funding_id);

CREATE INDEX ix_recommendation_logs_user_id ON recommendation_logs (user_id);

CREATE TABLE saved_funding (
    id SERIAL NOT NULL, 
    user_id INTEGER NOT NULL, 
    funding_id INTEGER NOT NULL, 
    status VARCHAR(24) NOT NULL, 
    notes TEXT, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    CONSTRAINT pk_saved_funding PRIMARY KEY (id), 
    CONSTRAINT fk_saved_funding_funding_id_funding_opportunities FOREIGN KEY(funding_id) REFERENCES funding_opportunities (id) ON DELETE CASCADE, 
    CONSTRAINT fk_saved_funding_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_saved_user_funding UNIQUE (user_id, funding_id)
);

CREATE INDEX ix_saved_funding_funding_id ON saved_funding (funding_id);

CREATE INDEX ix_saved_funding_user_id ON saved_funding (user_id);

INSERT INTO alembic_version (version_num) VALUES ('0001') RETURNING alembic_version.version_num;

COMMIT;

