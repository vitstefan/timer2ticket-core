import { ObjectId } from "mongodb";
import { ServiceTimeEntryObject } from "./service_time_entry_object";

export class TimeEntrySyncedObject {
  _id!: string | ObjectId;
  userId: string | ObjectId;
  lastUpdated: number;
  serviceTimeEntryObjects: ServiceTimeEntryObject[];

  constructor(userId: string | ObjectId) {
    this.userId = userId;
    this.lastUpdated = Date.now();
    this.serviceTimeEntryObjects = [];
  }
}