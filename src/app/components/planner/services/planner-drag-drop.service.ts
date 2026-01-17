import { Injectable } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Exercise, PlanItem, Session } from '../../../shared/models';

export interface PlannerDropResult {
  handled: boolean;
  addedExercise?: Exercise;
}

/**
 * Purpose: encapsulate planner drag-and-drop behavior and reorder helpers.
 * Input/Output: mutates provided sessions/items and returns drag-drop outcomes.
 * Error handling: assumes caller provides valid sessions and drop containers.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
@Injectable({ providedIn: 'root' })
export class PlannerDragDropService {
  reorderSessions(event: CdkDragDrop<Session[]>, sessions: Session[]): boolean {
    if (event.previousContainer !== event.container) return false;

    moveItemInArray(sessions, event.previousIndex, event.currentIndex);
    sessions.forEach((session, index) => {
      session.id = index + 1;
      session.name = `Sesión ${index + 1}`;
    });

    return true;
  }

  buildDropListConnections(sessions: Session[]): {
    exerciseListConnectedTo: string[];
    sessionsConnectedTo: Record<string, string[]>;
  } {
    const exerciseListConnectedTo = sessions.map(session => `session-${session.id}`);
    const sessionsConnectedTo = sessions.reduce((acc, session) => {
      acc[`session-${session.id}`] = [
        'exerciseList',
        ...sessions.filter(other => other.id !== session.id).map(other => `session-${other.id}`)
      ];
      return acc;
    }, {} as Record<string, string[]>);

    return { exerciseListConnectedTo, sessionsConnectedTo };
  }

  handleDrop(
    event: CdkDragDrop<any, any>,
    session: Session,
    sessions: Session[],
    buildPlanItemFromExercise: (exercise: Exercise) => PlanItem
  ): PlannerDropResult {
    const prevId = event.previousContainer.id;
    const currId = event.container.id;
    const draggedItem = event.item.data;

    if (this.isChildItem(draggedItem, session)) {
      this.handleChildDrop(draggedItem, event, session);
      return { handled: true };
    }

    if (prevId === currId) {
      moveItemInArray(session.items, event.previousIndex, event.currentIndex);
      session.items = [...session.items];
      return { handled: true };
    }

    if (prevId === 'exerciseList') {
      const exercise = event.item.data as Exercise;
      const newItem = buildPlanItemFromExercise(exercise);
      session.items.splice(event.currentIndex, 0, newItem);
      session.items = [...session.items];
      return { handled: true, addedExercise: exercise };
    }

    if (prevId.startsWith('session-') && currId.startsWith('session-')) {
      transferArrayItem(event.previousContainer.data, session.items, event.previousIndex, event.currentIndex);
      const fromId = parseInt(prevId.split('-')[1], 10);
      const fromSession = sessions.find(s => s.id === fromId)!;
      session.items = [...session.items];
      fromSession.items = [...fromSession.items];
      return { handled: true };
    }

    return { handled: false };
  }

  handleDragMoved(event: { pointerPosition?: { y?: number } }): void {
    const y = event.pointerPosition?.y ?? 0;
    const threshold = 80;
    if (y < threshold) {
      window.scrollBy({ top: -20, behavior: 'smooth' });
    } else if (y > (window.innerHeight - threshold)) {
      window.scrollBy({ top: 20, behavior: 'smooth' });
    }
  }

  private isChildItem(item: any, session: Session): boolean {
    return session.items.some(group => group.isGroup && group.children?.includes(item));
  }

  private handleChildDrop(child: PlanItem, event: CdkDragDrop<any, any>, session: Session): void {
    const group = session.items.find(groupItem => groupItem.isGroup && groupItem.children?.includes(child));
    if (!group) return;

    const childIndex = group.children!.indexOf(child);
    group.children!.splice(childIndex, 1);

    if (group.children!.length === 0) {
      const groupIndex = session.items.indexOf(group);
      session.items.splice(groupIndex, 1);
    }

    session.items.splice(event.currentIndex, 0, child);
    session.items = [...session.items];
  }
}
