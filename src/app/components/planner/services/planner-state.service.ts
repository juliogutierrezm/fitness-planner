import { Injectable } from '@angular/core';
import { Exercise, PlanItem, Session } from '../../../shared/models';

export interface GroupUndoSnapshot {
  index: number;
  snapshot: PlanItem;
}

/**
 * Purpose: centralize planner session/item state mutations and local storage helpers.
 * Input/Output: mutates provided sessions/items and returns snapshots when needed.
 * Error handling: returns null on invalid input and guards UI-state parsing.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
@Injectable({ providedIn: 'root' })
export class PlannerStateService {
  buildPlanItemFromExercise(exercise: Exercise, overrides: Partial<PlanItem> = {}): PlanItem {
    const defaults: Partial<PlanItem> = {
      sets: 3,
      reps: 10,
      rest: 60,
      weight: undefined,
      selected: false,
      isGroup: false
    };

    return {
      ...exercise,
      ...defaults,
      ...overrides,
      id: exercise.id,
      name: exercise.name_es || exercise.name || 'Ejercicio sin nombre',
      name_es: exercise.name_es,
      equipment_type: exercise.equipment_type || ''
    } as PlanItem;
  }

  removeItem(session: Session, index: number): PlanItem | null {
    if (!session.items[index]) return null;
    const removed = session.items[index];
    session.items.splice(index, 1);
    session.items = [...session.items];
    return removed;
  }

  restoreItem(session: Session, index: number, item: PlanItem): void {
    session.items.splice(index, 0, item);
    session.items = [...session.items];
  }

  toggleAllSelection(session: Session): void {
    const allSelected = this.allSelected(session);
    session.items.forEach(item => {
      if (!item.isGroup) {
        item.selected = !allSelected;
      }
    });
  }

  allSelected(session: Session): boolean {
    return session.items.every(item => item.isGroup || item.selected);
  }

  someSelected(session: Session): boolean {
    return session.items.some(item => !item.isGroup && item.selected);
  }

  hasSelectedItems(session: Session): boolean {
    return session.items.filter(item => !item.isGroup && item.selected).length >= 2;
  }

  hasSelectedGroup(session: Session): boolean {
    return session.items.some(item => item.isGroup && item.selected);
  }

  groupSelected(session: Session): boolean {
    const selectedItems = session.items.filter(item => !item.isGroup && item.selected);
    if (selectedItems.length < 2) return false;

    let newId = Date.now();
    while (session.items.some(item => Number(item.id) === newId)) {
      newId += 1;
    }

    const group: PlanItem = {
      id: newId.toString(),
      name: 'Superserie',
      sets: 0,
      reps: 0,
      rest: 0,
      isGroup: true,
      children: selectedItems.map(item => ({ ...item, selected: false }))
    };

    const firstIndex = session.items.findIndex(item => !item.isGroup && item.selected);
    session.items = session.items.filter(item => item.isGroup || !item.selected);
    session.items.splice(firstIndex, 0, group);
    return true;
  }

  ungroupSelected(session: Session): GroupUndoSnapshot | null {
    const group = session.items.find(item => item.isGroup && item.selected);
    if (!group || !group.children) return null;

    const index = session.items.indexOf(group);
    const snapshot: PlanItem = JSON.parse(JSON.stringify(group));
    session.items.splice(index, 1, ...group.children);
    return { index, snapshot };
  }

  ungroupGroup(session: Session, index: number): GroupUndoSnapshot | null {
    const group = session.items[index];
    if (!group?.isGroup || !group.children) return null;

    const snapshot: PlanItem = JSON.parse(JSON.stringify(group));
    session.items = [
      ...session.items.slice(0, index),
      ...group.children,
      ...session.items.slice(index + 1)
    ];

    return { index, snapshot };
  }

  restoreGroup(session: Session, index: number, snapshot: PlanItem): void {
    session.items.splice(index, snapshot.children?.length || 0, snapshot);
    session.items = [...session.items];
  }

  canDragGroup(): boolean {
    return true;
  }

  removeGroup(session: Session, index: number): PlanItem | null {
    return this.removeItem(session, index);
  }

  addExerciseToSession(session: Session, exercise: Exercise): PlanItem {
    const item = this.buildPlanItemFromExercise(exercise, { weight: undefined });
    session.items = [item, ...session.items];
    return item;
  }

  toggleFavorite(favorites: Exercise[], exercise: Exercise): Exercise[] {
    const exists = favorites.find(fav => fav.id === exercise.id);
    const nextFavorites = exists
      ? favorites.filter(fav => fav.id !== exercise.id)
      : [exercise, ...favorites].slice(0, 50);

    localStorage.setItem('fp_favorites', JSON.stringify(nextFavorites));

    return nextFavorites;
  }

  isFavorite(favorites: Exercise[], exercise: Exercise): boolean {
    return favorites.some(fav => fav.id === exercise.id);
  }

  addRecent(recents: Exercise[], exercise: Exercise): Exercise[] {
    const nextRecents = [exercise, ...recents.filter(item => item.id !== exercise.id)].slice(0, 12);
    localStorage.setItem('fp_recents', JSON.stringify(nextRecents));
    return nextRecents;
  }

  toggleCollapse(session: Session): void {
    session.collapsed = !session.collapsed;
  }

  applyUiState(sessions: Session[], uiKey: string): Session[] {
    try {
      const raw = localStorage.getItem(uiKey);
      if (!raw) return sessions;
      const ui = JSON.parse(raw) as Array<{ id: number; collapsed?: boolean }>;
      const map = new Map(ui.map(entry => [entry.id, entry]));
      return sessions.map(session => ({ ...session, ...map.get(session.id) }));
    } catch {
      return sessions;
    }
  }

  persistUiState(sessions: Session[], uiKey: string): void {
    const minimal = sessions.map(session => ({ id: session.id, collapsed: session.collapsed }));
    localStorage.setItem(uiKey, JSON.stringify(minimal));
  }
}
