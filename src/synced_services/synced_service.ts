import { Mapping } from "../models/mapping/mapping";
import { MappingsObject } from "../models/mapping/mappings_object";
import { ServiceObject } from "../models/synced_service/service_object/service_object";
import { TimeEntry } from "../models/synced_service/time_entry/time_entry";

export interface SyncedService {
  /**
   * Get all service objects which: projects, issues, activities etc.
   */
  getAllServiceObjects(): Promise<ServiceObject[]>;

  /**
   * Get one service object -> based on type & id
   * If type was not specified, service would need to ask for all its serviceObject and then filter by id
   * 
   * @param id id of serviceObject
   * @param type type of wanted serviceObject
   */
  getServiceObject(id: string | number, objectType: string): Promise<ServiceObject | undefined>;

  /**
   * Create service object like project, issue, tag and activity in the service, and return newly created one
   * 
   * Typically created with name '[objectName] ([objectType])'
   * @param objectName name of serviceObject
   * @param objectType type of serviceObject, ('tag', ...)
   */
  createServiceObject(objectId: string | number, objectName: string, objectType: string): Promise<ServiceObject>;

  /**
   * Update service object like project, issue, tag and activity in the service, and return updated one
   * Used generally to update the object's name
   * Typically with name '[objectName] ([objectType])'
   * @param objectId id of object to update
   * @param serviceObject serviceObject based on real object in primary service to extract name and possibly type for
   */
  updateServiceObject(objectId: string | number, serviceObject: ServiceObject): Promise<ServiceObject>;

  deleteServiceObject(id: string | number, objectType: string): Promise<boolean>;

  /**
   * Generates full name for given service object (Toggl, for example, generates names for tags as 'name (type)' or if issue, then '#id name (type)')
   * @param serviceObject 
   */
  getFullNameForServiceObject(serviceObject: ServiceObject): string;

  /**
   * getTimeEntries
   */
  getTimeEntries(start?: Date, end?: Date): Promise<TimeEntry[]>;

  /**
   * Create a new time entry real object in the service, returns specific TimeEntry
   * @param durationInMilliseconds 
   * @param start 
   * @param end 
   * @param text 
   * @param additionalData 
   */
  createTimeEntry(durationInMilliseconds: number, start: Date, end: Date, text: string, additionalData: ServiceObject[]): Promise<TimeEntry | null>;

  /**
   * Delete time entry with given id, returns true if successfully deleted
   * @param id of the time entry to delete from the service
   */
  deleteTimeEntry(id: string | number): Promise<boolean>;

  /**
   * Extracts objects from specific timeEntry, e.g. toggl extracts projectId from projectId, issue and time entry activity from TE's tags
   * @param timeEntry timeEntry object from which mappingsObjects are extracting - each specific manager has its specific time entry instance (e.g. TogglTimeEntry)
   * @param mappings user's mappings where to find mappingsObjects (by id)
   */
  extractMappingsObjectsFromTimeEntry(timeEntry: TimeEntry, mappings: Mapping[]): MappingsObject[];
}