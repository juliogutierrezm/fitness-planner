import { Exercise, PlanItem, Session } from './models';

const EQUIPMENT_UNDEFINED_LABEL = 'Equipo no definido';
const NAME_UNDEFINED_LABEL = 'Nombre no disponible';
const MEDIA_FIELDS = ['youtube_url', 'preview_url', 'thumbnail', 'gif_url'];
const SESSION_FIELD_KEYS = new Set<string>([
  'sets',
  'reps',
  'rest',
  'weight',
  'rpe',
  'notes',
  'selected',
  'isGroup',
  'children',
  'isGroupHeader',
  'isChild',
  'groupId'
]);

function hasExerciseName(item: PlanItem): boolean {
  const name = item?.name_es?.trim() || item?.name?.trim();
  return Boolean(name);
}

function hasExerciseMedia(item: PlanItem): boolean {
  return MEDIA_FIELDS.some(field => {
    const value = (item as PlanItem & Record<string, unknown>)[field];
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    return Boolean(value);
  });
}

/**
 * Purpose: check whether a plan item is missing minimum exercise information.
 * Input: PlanItem. Output: boolean.
 * Error handling: returns false for group items and invalid inputs.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export function isPlanItemMissingMinimumInfo(item: PlanItem | null | undefined): boolean {
  if (!item || item.isGroup) return false;
  const hasName = hasExerciseName(item);
  const hasMedia = hasExerciseMedia(item);
  return !hasName || !hasMedia;
}

/**
 * Purpose: collect plan items that are missing minimum exercise info.
 * Input: sessions array. Output: list of incomplete items.
 * Error handling: returns empty list for invalid sessions.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export function findIncompletePlanItems(sessions: Session[]): PlanItem[] {
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const incomplete: PlanItem[] = [];

  const collect = (items: PlanItem[]) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item) continue;
      if (item.isGroup && Array.isArray(item.children)) {
        collect(item.children);
        continue;
      }
      if (isPlanItemMissingMinimumInfo(item)) {
        incomplete.push(item);
      }
    }
  };

  for (const session of safeSessions) {
    collect(session?.items || []);
  }

  return incomplete;
}

/**
 * Purpose: determine gym mode based on the tenant companyId claim.
 * Input: companyId string | null | undefined. Output: boolean.
 * Error handling: treats missing companyId as INDEPENDENT fallback.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export function isGymMode(companyId?: string | null): boolean {
  const normalized = companyId || 'INDEPENDENT';
  return normalized !== 'INDEPENDENT';
}

/**
 * Purpose: sanitize exercise name for ID generation by replacing spaces and special characters with underscores.
 * Input: name string. Output: normalized string.
 * Error handling: none; pure string transform with safe defaults.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')  // Replace spaces with underscores
    .replace(/[^a-z0-9_]/g, '_')  // Replace special characters with underscores
    .replace(/_+/g, '_')  // Replace multiple consecutive underscores with a single underscore
    .replace(/^_+|_+$/g, '');  // Remove leading/trailing underscores
}

/**
 * Purpose: calculate age from date of birth string (ISO format: YYYY-MM-DD or full ISO).
 * Input: dateOfBirth string. Output: number or null.
 * Error handling: returns null for invalid or missing dates.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export function calculateAge(dateOfBirth: string): number | null {
  if (!dateOfBirth) return null;

  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  return age >= 0 ? age : null;
}

/**
 * Purpose: derive a displayable equipment label for a plan item using equipment_type only.
 * Input: PlanItem with optional children. Output: equipment label string.
 * Error handling: returns a missing-equipment label when equipment_type data is missing.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export function getPlanItemEquipmentLabel(item: PlanItem): string {
  if (!item?.isGroup) {
    return item?.equipment_type?.trim() || EQUIPMENT_UNDEFINED_LABEL;
  }

  const children = item.children || [];
  const seen = new Set<string>();
  const labels: string[] = [];

  for (const child of children) {
    const equipmentType = child.equipment_type?.trim();
    if (!equipmentType || seen.has(equipmentType)) continue;
    seen.add(equipmentType);
    labels.push(equipmentType);
  }

  if (labels.length === 0) return EQUIPMENT_UNDEFINED_LABEL;
  return labels.length === 1 ? labels[0] : labels.join(' / ');
}

/**
 * Purpose: derive a displayable name for a plan item using name_es only.
 * Input: PlanItem. Output: name label string.
 * Error handling: returns a missing-name label when name_es is missing.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export function getPlanItemDisplayName(item: PlanItem): string {
  return item?.name_es?.trim() || NAME_UNDEFINED_LABEL;
}

function isMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function mergeExerciseWithSession(base: Exercise, item: PlanItem): PlanItem {
  const merged: PlanItem & Record<string, unknown> = {
    ...base,
    id: base.id,
    name: item?.name?.trim() || base.name || base.name_es || NAME_UNDEFINED_LABEL,
    name_es: item?.name_es || base.name_es,
    sets: item?.sets ?? 0,
    reps: item?.reps ?? 0,
    rest: item?.rest ?? 0,
    isGroup: item?.isGroup ?? false
  };

  Object.entries(item || {}).forEach(([key, value]) => {
    if (key === 'exerciseId') return;
    if (SESSION_FIELD_KEYS.has(key)) {
      if (value !== undefined) {
        merged[key] = value;
      }
      return;
    }
    if (!isMeaningfulValue(value)) return;
    merged[key] = value;
  });

  merged.id = base.id;
  return merged;
}

/**
 * Purpose: normalize plan items for rendering by ensuring groups contain normalized children arrays.
 * Input: PlanItem array. Output: normalized PlanItem array.
 * Error handling: treats missing arrays as empty lists.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export function normalizePlanItemsForRender(items: PlanItem[]): PlanItem[] {
  const safeItems = Array.isArray(items) ? items : [];
  return safeItems.map(item => ({
    ...item,
    children: item?.isGroup ? normalizePlanItemsForRender(item.children || []) : item.children
  }));
}

/**
 * Purpose: normalize plan sessions for rendering by ensuring consistent item structures.
 * Input: Session array. Output: normalized Session array.
 * Error handling: treats missing arrays as empty lists.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export function normalizePlanSessionsForRender(sessions: Session[]): Session[] {
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  return safeSessions.map(session => ({
    ...session,
    items: normalizePlanItemsForRender(session.items || [])
  }));
}

/**
 * Purpose: enrich plan items with ExerciseLibrary metadata using exerciseId or missing exercise info.
 * Input: sessions array + exercise map. Output: sessions array with enriched items.
 * Error handling: returns original sessions when map is empty or exercise is missing.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export function enrichPlanSessionsFromLibrary(
  sessions: Session[],
  exerciseMap: Map<string, Exercise>
): Session[] {
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const hasCandidates = safeSessions.some(session => hasEnrichmentCandidateInItems(session?.items || []));
  if (!hasCandidates) return safeSessions;
  if (!exerciseMap || exerciseMap.size === 0) {
    console.warn('[PlanEnrichment] exercise map not ready; skipping enrichment');
    return safeSessions;
  }

  return safeSessions.map(session => ({
    ...session,
    items: (session.items || []).map(item => enrichPlanItemFromLibrary(item, exerciseMap))
  }));
}

/**
 * Purpose: enrich a single plan item or group recursively with ExerciseLibrary data.
 * Input: PlanItem (may include exerciseId or missing exercise info) and exercise map. Output: PlanItem.
 * Error handling: returns original item when base exercise is missing.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
function enrichPlanItemFromLibrary(item: PlanItem, exerciseMap: Map<string, Exercise>): PlanItem {
  if (item?.isGroup && Array.isArray(item.children)) {
    return {
      ...item,
      children: item.children.map(child => enrichPlanItemFromLibrary(child, exerciseMap))
    };
  }

  const exerciseId = (item as PlanItem & { exerciseId?: string })?.exerciseId || item?.id;
  const shouldEnrich = Boolean((item as PlanItem & { exerciseId?: string })?.exerciseId)
    || isPlanItemMissingMinimumInfo(item);
  if (exerciseId && shouldEnrich) {
    const base = exerciseMap.get(exerciseId);
    if (!base) {
      console.warn('[PlanEnrichment] exercise not found:', exerciseId);
      return item;
    }

    return mergeExerciseWithSession(base, item);
  }

  return item;
}

/**
 * Purpose: detect if any plan items need enrichment.
 * Input: PlanItem array. Output: boolean.
 * Error handling: treats invalid arrays as empty.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
function hasEnrichmentCandidateInItems(items: PlanItem[]): boolean {
  if (!Array.isArray(items)) return false;
  for (const item of items) {
    if (!item) continue;
    if ((item as PlanItem & { exerciseId?: string })?.exerciseId) return true;
    if (item?.isGroup && hasEnrichmentCandidateInItems(item.children || [])) return true;
    if (isPlanItemMissingMinimumInfo(item)) return true;
  }
  return false;
}

/**
 * Purpose: parse and normalize raw plan sessions input from API or storage.
 * Input: unknown session payload (string or array). Output: Session array.
 * Error handling: catches JSON parse errors and returns an empty array.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export function parsePlanSessions(rawSessions: unknown): Session[] {
  if (!rawSessions) return [];
  if (typeof rawSessions === 'string') {
    try {
      return normalizePlanSessionsForRender(JSON.parse(rawSessions));
    } catch (error) {
      console.error('Error parsing sessions JSON:', error);
      return [];
    }
  }
  if (Array.isArray(rawSessions)) {
    return normalizePlanSessionsForRender(rawSessions as Session[]);
  }
  return [];
}

/**
 * Purpose: validate that plan sessions contain renderable items or groups.
 * Input: Session array. Output: boolean indicating renderable content.
 * Error handling: treats invalid structures as non-renderable.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export function hasRenderablePlanContent(sessions: Session[]): boolean {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return false;
  }

  for (const session of sessions) {
    if (!session || !Array.isArray(session.items) || session.items.length === 0) {
      return false;
    }

    for (const item of session.items) {
      if (!item) return false;
      if (item.isGroup) {
        if (!Array.isArray(item.children) || item.children.length === 0) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Purpose: derive a stable key for plan identification in UI ordering.
 * Input: plan object with planId/id/SK. Output: string key or empty string.
 * Error handling: returns empty string when no identifier is available.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export function getPlanKey(plan: { planId?: string; id?: string; SK?: string } | null | undefined): string {
  if (!plan) return '';
  if (plan.planId) return plan.planId;
  if (plan.id) return plan.id;
  if (plan.SK && typeof plan.SK === 'string' && plan.SK.startsWith('PLAN#')) {
    return plan.SK.substring(5);
  }
  return '';
}

/**
 * Purpose: resolve a display name preferring templateName over plan name.
 * Input: plan with optional templateName/name. Output: displayable name string.
 * Error handling: returns empty string when no names are available.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export function getTemplateDisplayName(
  plan: { templateName?: string; name?: string } | null | undefined
): string {
  if (!plan) return '';
  const templateName = plan.templateName?.trim();
  if (templateName) return templateName;
  return plan.name?.trim() || '';
}

/**
 * Purpose: derive a numeric timestamp from a plan createdAt value.
 * Input: plan object with createdAt/created_at. Output: timestamp (ms).
 * Error handling: returns 0 for missing or invalid dates.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export function getPlanCreatedAtTime(plan: { createdAt?: string; created_at?: string } | null | undefined): number {
  const raw = plan?.createdAt || plan?.created_at;
  const ts = raw ? new Date(raw).getTime() : 0;
  return Number.isNaN(ts) ? 0 : ts;
}

/**
 * Purpose: return a new plan array sorted by createdAt ascending.
 * Input: plans array. Output: new sorted array.
 * Error handling: treats non-array input as empty array.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export function sortPlansByCreatedAt<T extends { createdAt?: string; created_at?: string }>(plans: T[]): T[] {
  const list = Array.isArray(plans) ? plans.slice() : [];
  return list.sort((a, b) => getPlanCreatedAtTime(a) - getPlanCreatedAtTime(b));
}

/**
 * Purpose: build a plan ordinal map from createdAt order for visual numbering.
 * Input: plans array. Output: Map of planKey -> ordinal (1-based).
 * Error handling: skips plans without a stable key.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export function buildPlanOrdinalMap<T extends { planId?: string; id?: string; SK?: string; createdAt?: string; created_at?: string }>(
  plans: T[]
): Map<string, number> {
  const map = new Map<string, number>();
  const ordered = sortPlansByCreatedAt(plans);

  ordered.forEach((plan, index) => {
    const key = getPlanKey(plan);
    if (!key) return;
    map.set(key, index + 1);
  });

  return map;
}
