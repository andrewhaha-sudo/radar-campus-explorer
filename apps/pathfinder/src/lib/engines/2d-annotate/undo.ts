// 2D annotation engine - undo/redo (Epic E5).
//
// Snapshot-based: each entry is a full JSON serialization of the annotation
// array. Two parallel stacks (annotations vs map markers) share this algorithm.
// Ported verbatim from v1 pushUndo/undo/redo, capped at UNDO_CAP=50.

import { UNDO_CAP } from './types';

/** A history holds the undo and redo stacks (arrays of JSON snapshots). */
export interface History {
	undo: string[];
	redo: string[];
}

export function newHistory(): History {
	return { undo: [], redo: [] };
}

/**
 * Snapshot `state` onto the undo stack BEFORE a mutating op. Clears the redo
 * stack (any new action invalidates redo) and caps depth at UNDO_CAP, dropping
 * the oldest entry. Returns the (mutated) history for chaining/clarity.
 */
export function pushUndo<T>(history: History, state: T): History {
	history.undo.push(JSON.stringify(state));
	history.redo = [];
	if (history.undo.length > UNDO_CAP) history.undo.shift();
	return history;
}

/**
 * Undo: push the current state onto redo, pop and return the previous state.
 * Returns null when there is nothing to undo (caller keeps current state).
 */
export function undo<T>(history: History, current: T): T | null {
	if (history.undo.length === 0) return null;
	history.redo.push(JSON.stringify(current));
	return JSON.parse(history.undo.pop() as string) as T;
}

/**
 * Redo: push the current state onto undo, pop and return the next state.
 * Returns null when there is nothing to redo.
 */
export function redo<T>(history: History, current: T): T | null {
	if (history.redo.length === 0) return null;
	history.undo.push(JSON.stringify(current));
	return JSON.parse(history.redo.pop() as string) as T;
}
