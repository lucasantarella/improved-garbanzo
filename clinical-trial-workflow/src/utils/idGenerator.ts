import { v4 as uuidv4 } from 'uuid';

export function generateActivityId(): string {
  return `act-${uuidv4().substring(0, 8)}`;
}
export function generateMilestoneId(): string {
  return `ms-${uuidv4().substring(0, 8)}`;
}
export function generateSwimLaneId(): string {
  return `sl-${uuidv4().substring(0, 8)}`;
}
