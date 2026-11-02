"""Innovation projects, weighted scoring, portfolio analytics and commercialization recommendations."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.core.deps import client_ip, get_current_user, is_manager
from app.db.session import get_db
from app.models import InnovationProject, User
from app.schemas.innovation import ProjectIn, ScoreOut, StageIn
from app.services import audit, commercialization, innovation_service, scoring

router = APIRouter(prefix="/innovation", tags=["Innovation scoring"])
commercial = APIRouter(prefix="/commercialization", tags=["Commercialization"])


@router.get("/weights")
def weights(user: User = Depends(get_current_user)) -> dict:
    return scoring.weights_payload()


@router.get("/projects")
def list_projects(scope: str = Query("mine", pattern="^(mine|all)$"), user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)) -> list[dict]:
    if scope == "all" and not is_manager(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only innovation managers and administrators can view all projects")
    return [innovation_service.to_out(p) for p in innovation_service.visible_projects(db, user, scope)]


@router.post("/projects", status_code=201)
def create_project(payload: ProjectIn, request: Request, user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)) -> dict:
    project = InnovationProject(owner_id=user.id, **payload.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    audit.record(db, "project.created", user, entity_type="project", entity_id=project.id, ip=client_ip(request))
    return innovation_service.to_out(project)


@router.get("/projects/{project_id}")
def get_project(project_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    project = innovation_service.get_project(db, project_id, user)
    return {**innovation_service.to_out(project), "score_history": [scoring.to_out(s) for s in project.scores]}


@router.put("/projects/{project_id}")
def update_project(project_id: int, payload: ProjectIn, user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)) -> dict:
    project = innovation_service.get_project(db, project_id, user, write=True)
    for k, v in payload.model_dump().items():
        setattr(project, k, v)
    db.commit()
    db.refresh(project)
    return innovation_service.to_out(project)


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: int, request: Request, user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)) -> Response:
    project = innovation_service.get_project(db, project_id, user, write=True)
    db.delete(project)
    db.commit()
    audit.record(db, "project.deleted", user, entity_type="project", entity_id=project_id, ip=client_ip(request))
    return Response(status_code=204)


@router.patch("/projects/{project_id}/stage")
def change_stage(project_id: int, payload: StageIn, user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)) -> dict:
    project = innovation_service.get_project(db, project_id, user, write=True, stage_change=True)
    project.stage = payload.stage
    db.commit()
    db.refresh(project)
    return innovation_service.to_out(project)


@router.post("/projects/{project_id}/score", response_model=ScoreOut)
def score_project(project_id: int, request: Request, user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)) -> dict:
    project = innovation_service.get_project(db, project_id, user, write=True, stage_change=True)
    owner = db.get(User, project.owner_id)
    result = scoring.compute(db, scoring.ProjectInput.from_project(project), owner)
    saved = scoring.persist(db, project, result, user)
    audit.record(db, "project.scored", user, entity_type="project", entity_id=project.id,
                 detail={"overall": result["overall"]}, ip=client_ip(request))
    return scoring.to_out(saved)


@router.post("/score-preview", response_model=ScoreOut)
def score_preview(payload: ProjectIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return scoring.compute(db, scoring.ProjectInput(**payload.model_dump()), user)


@router.get("/portfolio")
def portfolio(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return innovation_service.portfolio(db, user)


@commercial.get("/overview")
def commercial_overview(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    projects = innovation_service.visible_projects(db, user, "all" if is_manager(user) else "mine")
    return commercialization.overview(db, projects)


@commercial.get("/projects/{project_id}")
def commercial_project(project_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    project = innovation_service.get_project(db, project_id, user)
    result = commercialization.analyse(db, project, user)
    db.refresh(project)
    result["project"] = innovation_service.to_out(project)
    return result
