import { TimeEntry } from './time_entry';

export class TogglTimeEntry implements TimeEntry {
  id: number;
  projectId: number;
  text: string;
  start: Date;
  end: Date;
  durationInMilliseconds: number;
  tags: string[];
  lastUpdated: Date;

  constructor(id: number, projectId: number, text: string, start: Date, end: Date, duration: number, tags: string[], lastUpdated: Date) {
    this.id = id;
    this.projectId = projectId;
    this.text = text;
    this.start = start;
    this.end = end;
    this.durationInMilliseconds = duration;
    this.tags = tags;
    this.lastUpdated = lastUpdated;
  }

  // durationInMilliseconds = (): number => this.end.getTime() - this.start.getTime();
}