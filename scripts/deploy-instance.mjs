#!/usr/bin/env node
/**
 * Despliega a Production en el proyecto Vercel de una instancia.
 *
 * Uso:
 *   node scripts/deploy-instance.mjs helios
 *   node scripts/deploy-instance.mjs wework
 *
 * Config: crea `.env.vercel.helios` / `.env.vercel.wework` (ver *.example)
 * con VERCEL_ORG_ID + VERCEL_PROJECT_ID (recomendado)
 * o VERCEL_PROJECT_NAME para link + deploy.
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { spawnSync } from 'child_process';

const aliases = {
  helios: 'helios',
  wework: 'wework',
  'we-work': 'wework',
  packaging: 'wework',
  'packaging-wework': 'wework',
};

const raw = (process.argv[2] || '').toLowerCase().trim();
const instance = aliases[raw];

if (!instance) {
  console.error('Uso: node scripts/deploy-instance.mjs <helios|wework>');
  process.exit(1);
}

const envFile = resolve(process.cwd(), `.env.vercel.${instance}`);

function loadEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function run(cmd, args, env) {
  console.log(`\n> ${cmd} ${args.join(' ')}\n`);
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const fileEnv = loadEnvFile(envFile);
const env = { ...process.env, ...fileEnv };

const orgId = env.VERCEL_ORG_ID?.trim();
const projectId = env.VERCEL_PROJECT_ID?.trim();
const projectName = env.VERCEL_PROJECT_NAME?.trim();

console.log(`\nDesplegando instancia: ${instance}`);
if (existsSync(envFile)) {
  console.log(`Config: ${envFile}`);
} else {
  console.warn(`No existe ${envFile} — se usará solo VERCEL_PROJECT_NAME / link interactivo.`);
}

if (orgId && projectId) {
  run('vercel', ['--prod', '--yes'], env);
} else if (projectName) {
  run('vercel', ['link', '--project', projectName, '--yes'], env);
  run('vercel', ['--prod', '--yes'], env);
} else {
  console.error(`
Falta configuración para "${instance}".

Crea el archivo ${envFile} con una de estas opciones:

  # Opción A (recomendada) — IDs del proyecto Vercel
  VERCEL_ORG_ID=team_...
  VERCEL_PROJECT_ID=prj_...

  # Opción B — nombre del proyecto en Vercel
  VERCEL_PROJECT_NAME=packlens-${instance === 'helios' ? 'helios' : 'packaging-wework'}

Los IDs salen de: Vercel → Project → Settings → General
o de .vercel/project.json tras un "vercel link".
`);
  process.exit(1);
}

console.log(`\nListo: deploy Production de ${instance}.`);
