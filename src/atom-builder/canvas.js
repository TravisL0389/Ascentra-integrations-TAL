import { getGraphBounds, getNodePosition } from './model.js';
import { getPorts } from './definitions.js';

export const CANVAS_WIDTH = 6000;
export const CANVAS_HEIGHT = 2200;
export const NODE_WIDTH = 208;
export const NODE_HEIGHT = 112;
export const GRID_SIZE = 20;
export const DEFAULT_SNAP = GRID_SIZE;

export function snapValue(value, gridSize = DEFAULT_SNAP) {
  if (!Number.isFinite(value) || !Number.isFinite(gridSize) || gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

export function snapPoint(point, gridSize = DEFAULT_SNAP) {
  return { x: snapValue(point?.x, gridSize), y: snapValue(point?.y, gridSize) };
}

export function worldToCanvas(point, pan = { x: 0, y: 0 }) {
  return { x: (Number(point?.x) || 0) + (Number(pan?.x) || 0), y: (Number(point?.y) || 0) + (Number(pan?.y) || 0) };
}

export function canvasToWorld(point, pan = { x: 0, y: 0 }) {
  return { x: (Number(point?.x) || 0) - (Number(pan?.x) || 0), y: (Number(point?.y) || 0) - (Number(pan?.y) || 0) };
}

export function clientToCanvas(clientPoint, rect, pan = { x: 0, y: 0 }, zoom = 1) {
  const scale = Number(zoom) || 1;
  return worldToCanvas({ x: ((Number(clientPoint?.clientX) || 0) - (Number(rect?.left) || 0)) / scale, y: ((Number(clientPoint?.clientY) || 0) - (Number(rect?.top) || 0)) / scale }, pan);
}

export function canvasToClient(point, rect, pan = { x: 0, y: 0 }, zoom = 1) {
  const canvasPoint = worldToCanvas(point, pan);
  const scale = Number(zoom) || 1;
  return { clientX: (Number(rect?.left) || 0) + canvasPoint.x * scale, clientY: (Number(rect?.top) || 0) + canvasPoint.y * scale };
}

export function clampZoom(zoom, min = 0.35, max = 2.5) {
  return Math.min(max, Math.max(min, Number(zoom) || 1));
}

export function getZoomAtPoint(zoom, point, factor, min = 0.35, max = 2.5) {
  const next = clampZoom((Number(zoom) || 1) * factor, min, max);
  return { zoom: next, canvasPoint: point };
}

export function getNodeRect(node) {
  const position = getNodePosition(node);
  return { x: position.x, y: position.y, width: NODE_WIDTH, height: NODE_HEIGHT, right: position.x + NODE_WIDTH, bottom: position.y + NODE_HEIGHT };
}

export function getPortPosition(node, portId, side = 'right') {
  const position = getNodePosition(node);
  const direction = side === 'left' || side === 'input' ? 'input' : 'output';
  const ports = getPorts(node, direction);
  const index = Math.max(0, ports.findIndex((port) => port.id === portId));
  const spread = ports.length > 1 ? (NODE_HEIGHT - 32) * (index / (ports.length - 1) - 0.5) : 0;
  const y = position.y + NODE_HEIGHT / 2 + spread;
  if (direction === 'input') return { x: position.x, y };
  if (side === 'bottom') return { x: position.x + NODE_WIDTH / 2, y: position.y + NODE_HEIGHT };
  return { x: position.x + NODE_WIDTH, y };
}

export function getEdgePath(from, to) {
  const start = getPortPosition(from, null, 'right');
  const end = getPortPosition(to, null, 'left');
  const distance = Math.max(60, Math.abs(end.x - start.x) * 0.45);
  return `M ${start.x} ${start.y} C ${start.x + distance} ${start.y}, ${end.x - distance} ${end.y}, ${end.x} ${end.y}`;
}

export function isPointInRect(point, rect, padding = 0) {
  return Number(point?.x) >= rect.x - padding && Number(point?.x) <= rect.right + padding && Number(point?.y) >= rect.y - padding && Number(point?.y) <= rect.bottom + padding;
}

export function getNodeAtPoint(workflow, point) {
  const nodes = workflow?.nodes || [];
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    if (isPointInRect(point, getNodeRect(nodes[index]))) return nodes[index];
  }
  return null;
}

export function getVisibleNodes(workflow, viewport, options = {}) {
  const padding = options.padding ?? 200;
  const nodes = workflow?.nodes || [];
  const bounds = viewport || getGraphBounds(workflow);
  if (!bounds) return [];
  const minX = Number(bounds.left ?? bounds.minX ?? 0) - padding;
  const minY = Number(bounds.top ?? bounds.minY ?? 0) - padding;
  const maxX = Number(bounds.right ?? bounds.maxX ?? 0) + padding;
  const maxY = Number(bounds.bottom ?? bounds.maxY ?? 0) + padding;
  return nodes.filter((node) => {
    const rect = getNodeRect(node);
    return rect.right >= minX && rect.x <= maxX && rect.bottom >= minY && rect.y <= maxY;
  });
}

export function getSelectionBounds(nodes) {
  const list = Array.isArray(nodes) ? nodes : [];
  if (!list.length) return null;
  const rects = list.map(getNodeRect);
  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.right));
  const maxY = Math.max(...rects.map((rect) => rect.bottom));
  return { x: minX, y: minY, right: maxX, bottom: maxY, width: maxX - minX, height: maxY - minY };
}

export function selectionKey(ids) {
  return [...new Set((ids || []).map(String))].sort().join('|');
}

export function getConnectionKey(fromNodeId, toNodeId, sourcePortId = 'output', targetPortId = 'input') {
  return `${fromNodeId}:${sourcePortId}:${toNodeId}:${targetPortId}`;
}

export function getNextNodePosition(workflow, lane = 0, column = 0) {
  const occupied = (workflow?.nodes || []).filter((node) => Number(node?.lane) === Number(lane));
  return { lane: Number(lane) || 0, column: Math.max(Number(column) || 0, occupied.length) };
}
