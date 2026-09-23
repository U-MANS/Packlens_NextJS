import type { Project, ProjectDocument, DocumentVersion, Comment, Task, ActivityEvent } from '../types';

export const productLines = [
  'Mermeladas y confituras',
  'Conservas vegetales',
  'Conservas de fruta',
  'Salsas y untables',
  'Encurtidos',
  'Frutas en almíbar',
  'Edición especial / Export',
];

export const availableMarkets = [
  { code: 'ES', label: 'España' },
  { code: 'PT', label: 'Portugal' },
  { code: 'FR', label: 'Francia' },
  { code: 'IT', label: 'Italia' },
  { code: 'DE', label: 'Alemania' },
  { code: 'UK', label: 'Reino Unido' },
];

export const availableLanguages = [
  'Español',
  'Portugués',
  'Francés',
  'Italiano',
  'Alemán',
  'Inglés',
];

export const mockProjects: Project[] = [
  {
    id: 'p-1',
    name: 'Mermelada de Fresa 340g',
    sku: 'MER-FRE-340',
    market: 'España',
    language: 'ES',
    status: 'En aprobación diseño',
    owner: 'Carlos Ruiz',
    targetDate: '2026-06-15',
    description: 'Actualización de diseño para destacar "0% azúcares añadidos".',
    phase: 'Aprobación Diseño',
    createdAt: '2026-04-20T10:00:00Z',
    archived: false,
    version: 1,
    lifecycleStatus: 'Borrador',
    productLine: 'Mermeladas y confituras',
    format: 'Tarro vidrio 340g',
    markets: ['ES', 'PT', 'FR'],
    labelLanguages: ['Español', 'Portugués', 'Francés'],
    launchDate: '2026-09-15',
    artDeadline: '2026-07-15',
    regulatoryContact: 'Luis Martín',
    briefing: {
      fileName: 'briefing_mermelada_fresa_v1.pdf',
      fileSizeKb: 412,
      uploadedAt: '2026-04-20T10:05:00Z',
      notes: 'Claim principal "Sin conservantes". Color Pantone 185C. Incluir semáforo nutricional y tabla de alérgenos actualizada 2024.',
    },
  },
  {
    id: 'p-2',
    name: 'Tomate Frito Receta Casera',
    sku: 'TOM-CAS-500',
    market: 'Portugal',
    language: 'PT',
    status: 'En diseño',
    owner: 'Ana Torres',
    targetDate: '2026-07-01',
    description: 'Nuevo packaging para campaña de verano.',
    phase: 'Diseño',
    createdAt: '2026-04-25T09:30:00Z',
    archived: false,
    version: 1,
    lifecycleStatus: 'Borrador',
  },
  {
    id: 'p-3',
    name: 'Melocotón en Almíbar',
    sku: 'MEL-ALM-800',
    market: 'Francia',
    language: 'FR',
    status: 'En arte final',
    owner: 'Luis Gómez',
    targetDate: '2026-05-10',
    description: 'Ajuste de textos legales según nueva normativa FR.',
    phase: 'Arte final',
    createdAt: '2026-03-15T11:20:00Z',
    archived: false,
    version: 1,
    lifecycleStatus: 'Borrador',
  },
  {
    id: 'p-4',
    name: 'Pimiento Asado en Tiras',
    sku: 'PIM-ASA-250',
    market: 'España',
    language: 'ES',
    status: 'Aprobado',
    owner: 'Marta Díaz',
    targetDate: '2026-04-28',
    description: 'Lanzamiento de nuevo formato.',
    phase: 'Aprobado',
    createdAt: '2026-02-10T14:00:00Z',
    archived: false,
    version: 1,
    lifecycleStatus: 'Borrador',
  },
  {
    id: 'p-5',
    name: 'Edición Export Francia - Mix',
    sku: 'MIX-EXP-FR',
    market: 'Francia',
    language: 'FR',
    status: 'En aprobación legal',
    owner: 'Jorge López',
    targetDate: '2026-06-30',
    description: 'Revisión de ingredientes traducidos.',
    phase: 'Aprobación Legal',
    createdAt: '2026-04-22T16:45:00Z',
    archived: false,
    version: 1,
    lifecycleStatus: 'Borrador',
  }
];

export const mockDocuments: ProjectDocument[] = [
  { id: 'd-1', projectId: 'p-1', title: 'Arte Final Fresa v2', type: 'Arte final', currentVersion: 'v2', status: 'En revisión', createdAt: '2026-04-22T09:00:00Z' },
  { id: 'd-2', projectId: 'p-1', title: 'Ficha Técnica 2026', type: 'Ficha técnica', currentVersion: 'v1', status: 'Aprobado', createdAt: '2026-04-20T10:05:00Z' },
  { id: 'd-3', projectId: 'p-3', title: 'Textos Legales FR', type: 'Traducciones', currentVersion: 'v3', status: 'Aprobado', createdAt: '2026-03-20T11:00:00Z' }
];

export const mockVersions: DocumentVersion[] = [
  { id: 'v-1', documentId: 'd-1', versionLabel: 'v1', createdAt: '2026-04-21T10:00:00Z', author: 'Ana Torres (Diseño)', reviewStatus: 'Cambios solicitados', notes: 'Primera propuesta de layout' },
  { id: 'v-2', documentId: 'd-1', versionLabel: 'v2', createdAt: '2026-04-22T09:00:00Z', author: 'Ana Torres (Diseño)', reviewStatus: 'En revisión', notes: 'Corregido el claim principal' }
];

export const mockTasks: Task[] = [
  { id: 't-1', projectId: 'p-1', title: 'Revisar porcentaje de fruta en frontal', owner: 'I+D Team', role: 'I+D', status: 'Pendiente', priority: 'Alta', dueDate: '2026-04-30' },
  { id: 't-2', projectId: 'p-1', title: 'Subir troquel actualizado', owner: 'Alex Cosials WW', role: 'Diseño', status: 'Completada', priority: 'Media', dueDate: '2026-04-22' },
  { id: 't-3', projectId: 'p-3', title: 'Validar textos legales Francia', owner: 'I+D Team', role: 'I+D', status: 'Completada', priority: 'Alta', dueDate: '2026-04-15' },
  { id: 't-4', projectId: 'p-5', title: 'Confirmar lista de alérgenos', owner: 'I+D Team', role: 'I+D', status: 'Pendiente', priority: 'Alta', dueDate: '2026-05-05' }
];

export const mockComments: Comment[] = [
  { id: 'c-1', projectId: 'p-1', documentId: 'd-1', versionId: 'v-1', author: 'Carlos Ruiz', role: 'Marketing', text: 'El logo se ve muy pequeño, ¿podemos aumentarlo un 15%?', resolved: true, createdAt: '2026-04-21T11:30:00Z' },
  { id: 'c-2', projectId: 'p-1', documentId: 'd-1', versionId: 'v-2', author: 'I+D Team', role: 'I+D', text: 'La tabla nutricional no coincide con la ficha técnica adjunta. Falta indicar los valores de fibra.', resolved: false, createdAt: '2026-04-23T09:15:00Z' }
];

export const mockActivity: ActivityEvent[] = [
  { id: 'a-1', projectId: 'p-1', type: 'PROJECT_CREATED', text: 'Carlos Ruiz creó el proyecto', actor: 'Carlos Ruiz', createdAt: '2026-04-20T10:00:00Z' },
  { id: 'a-2', projectId: 'p-1', type: 'DOCUMENT_UPLOADED', text: 'Ana Torres subió "Arte Final Fresa v1"', actor: 'Ana Torres', createdAt: '2026-04-21T10:00:00Z' },
  { id: 'a-3', projectId: 'p-1', type: 'COMMENT_ADDED', text: 'Carlos Ruiz añadió un comentario', actor: 'Carlos Ruiz', createdAt: '2026-04-21T11:30:00Z' },
  { id: 'a-4', projectId: 'p-1', type: 'PHASE_CHANGED', text: 'Fase cambiada a "Aprobación Diseño"', actor: 'Carlos Ruiz', createdAt: '2026-04-22T09:10:00Z' }
];
