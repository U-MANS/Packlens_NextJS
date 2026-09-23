import type { DbUser } from '@/lib/server/auth';

type ProjectRow = Record<string, unknown> & {
  id: string;
  name: string;
  sku: string;
  status: string;
  phase: string;
  archived: boolean;
  lifecycle_status: string;
  version: number;
  discontinued: boolean;
  created_at: string;
  owner_user?: { name?: string } | null;
};

function asList(val: unknown): string[] | null {
  if (val == null) return null;
  if (Array.isArray(val)) return val.map(String);
  return null;
}

export function projectToRead(project: ProjectRow) {
  return {
    id: project.id,
    name: project.name,
    sku: project.sku,
    market: project.market ?? null,
    language: project.language ?? null,
    flow_type: project.flow_type ?? null,
    status: project.status,
    phase: project.phase,
    owner: project.owner_user?.name ?? null,
    target_date: project.target_date ?? null,
    description: project.description ?? null,
    created_at: project.created_at,
    archived: Boolean(project.archived),
    lifecycle_status: project.lifecycle_status,
    sap_code: project.sap_code ?? null,
    version: project.version ?? 1,
    previous_version_id: project.previous_version_id ?? null,
    substitution_type: project.substitution_type ?? null,
    temporal_end_date: project.temporal_end_date ?? null,
    discontinued: Boolean(project.discontinued),
    product_line: project.product_line ?? null,
    format: project.format ?? null,
    markets: asList(project.markets),
    label_languages: asList(project.label_languages),
    label_languages_front: asList(project.label_languages_front),
    label_languages_back: asList(project.label_languages_back),
    launch_date: project.launch_date ?? null,
    art_deadline: project.art_deadline ?? null,
    regulatory_contact: project.regulatory_contact ?? null,
    design_lead: project.design_lead ?? null,
    briefing: project.briefing ?? null,
  };
}

export type { DbUser };
