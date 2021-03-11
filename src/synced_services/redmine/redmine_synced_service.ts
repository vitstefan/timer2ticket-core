import { ServiceDefinition } from "../../models/service_definition/service_definition";
import { TimeEntry } from "../../models/synced_service/time_entry/time_entry";
import { SyncedService } from "../synced_service";
import superagent from "superagent";
import { ServiceObject } from "../../models/synced_service/service_object/service_object";
import { RedmineTimeEntry } from "../../models/synced_service/time_entry/redmine_time_entry";
import { Utilities } from "../../shared/utilities";
import { MappingsObject } from "../../models/mapping/mappings_object";
import { Mapping } from "../../models/mapping/mapping";

export class RedmineSyncedService implements SyncedService {
  private _serviceDefinition: ServiceDefinition;

  private _projectsUri: string;
  private _issuesUri: string;
  private _timeEntryActivitiesUri: string;
  private _timeEntriesUri: string;

  private _projectsType: string;
  private _issuesType: string;
  private _timeEntryActivitiesType: string;

  constructor(serviceDefinition: ServiceDefinition) {
    if (serviceDefinition.config.apiPoint === null) {
      throw 'Redmine ServiceDefinition apiPoint has to be defined.';
    }

    this._serviceDefinition = serviceDefinition;

    this._projectsUri = `${serviceDefinition.config.apiPoint}projects.json`;
    this._issuesUri = `${serviceDefinition.config.apiPoint}issues.json`;
    this._timeEntryActivitiesUri = `${serviceDefinition.config.apiPoint}enumerations/time_entry_activities.json`;
    this._timeEntriesUri = `${serviceDefinition.config.apiPoint}time_entries.json`;

    this._projectsType = 'project';
    this._issuesType = 'issue';
    this._timeEntryActivitiesType = 'activity';
  }

  async getAllServiceObjects(): Promise<ServiceObject[]> {
    const projects = await this._getAllProjects();
    const additionalServiceObjects = await this._getAllAdditionalServiceObjects();
    return projects.concat(additionalServiceObjects);
  }

  async getServiceObject(id: string | number, objectType: string): Promise<ServiceObject | undefined> {
    switch (objectType) {
      case this._projectsType:
        return (await this._getAllProjects()).find(project => project.id === id);
      default:
        return (await this._getAllAdditionalServiceObjects()).find(serviceObject => serviceObject.id === id);
    }
  }

  async createServiceObject(): Promise<ServiceObject> {
    // TODO implement
    throw new Error("Method not implemented.");
  }

  async updateServiceObject(): Promise<ServiceObject> {
    // TODO implement
    throw new Error("Method not implemented.");
  }

  async deleteServiceObject(): Promise<boolean> {
    // TODO implement
    throw new Error("Method not implemented.");
  }

  getFullNameForServiceObject(serviceObject: ServiceObject): string {
    return serviceObject.name;
  }

  // ***********************************************************
  // PROJECTS **************************************************
  // ***********************************************************


  private async _getAllProjects(): Promise<ServiceObject[]> {
    const response = await superagent
      .get(this._projectsUri)
      .accept('application/json')
      .type('application/json')
      .set('X-Redmine-API-Key', this._serviceDefinition.apiKey);

    const projects: ServiceObject[] = [];

    response.body.projects.forEach((project: never) => {
      projects.push(
        new ServiceObject(
          project['id'],
          project['name'],
          this._projectsType,
        ));
    });

    return projects;
  }

  private async _createProject(): Promise<ServiceObject> {
    //TODO implement
    throw new Error("Method not implemented.");
  }

  private async _updateProject(): Promise<ServiceObject> {
    //TODO implement
    throw new Error("Method not implemented.");
  }

  private async _deleteProject(): Promise<boolean> {
    //TODO implement
    throw new Error("Method not implemented.");
  }

  // ***********************************************************
  // OTHER SERVICE OBJECTS *************************************
  // ***********************************************************

  /**
   * Return Issues and Activities both in array of service objects
   */
  private async _getAllAdditionalServiceObjects(): Promise<ServiceObject[]> {
    const responseIssues = await superagent
      .get(this._issuesUri)
      .accept('application/json')
      .type('application/json')
      .set('X-Redmine-API-Key', this._serviceDefinition.apiKey);

    const issues: ServiceObject[] = [];

    responseIssues.body['issues'].forEach((issue: never) => {
      issues.push(
        new ServiceObject(
          issue['id'],
          issue['subject'],
          this._issuesType,
        ));
    });

    const responseTimeEntryActivities = await superagent
      .get(this._timeEntryActivitiesUri)
      .accept('application/json')
      .type('application/json')
      .set('X-Redmine-API-Key', this._serviceDefinition.apiKey);

    const timeEntryActivities: ServiceObject[] = [];

    responseTimeEntryActivities.body['time_entry_activities'].forEach((timeEntryActivity: never) => {
      timeEntryActivities.push(
        new ServiceObject(
          timeEntryActivity['id'],
          timeEntryActivity['name'],
          this._timeEntryActivitiesType,
        ));
    });

    // return concatenation of two arrays
    return issues.concat(timeEntryActivities);
  }

  private async _createIssue(): Promise<ServiceObject> {
    //TODO implement
    throw new Error("Method not implemented.");
  }

  private async _updateIssue(): Promise<ServiceObject> {
    //TODO implement
    throw new Error("Method not implemented.");
  }

  private async _deleteIssue(): Promise<boolean> {
    //TODO implement
    throw new Error("Method not implemented.");
  }

  // ***********************************************************
  // TIME ENTRIES **********************************************
  // ***********************************************************

  async getTimeEntries(start?: Date, end?: Date): Promise<TimeEntry[]> {
    let queryParams = {};
    if (start && end) {
      queryParams = {
        from: Utilities.getOnlyDateString(start),
        to: Utilities.getOnlyDateString(end),
      }
    }

    const response = await superagent
      .get(this._timeEntriesUri)
      .accept('application/json')
      .type('application/json')
      .set('X-Redmine-API-Key', this._serviceDefinition.apiKey)
      .query(queryParams);

    const entries: RedmineTimeEntry[] = [];

    response.body['time_entries'].forEach((timeEntry: never) => {
      const durationInMilliseconds = timeEntry['hours'] * 60 * 60 * 1000;
      const start = new Date(timeEntry['spent_on']);
      const end = new Date(new Date(timeEntry['spent_on']).setMilliseconds(durationInMilliseconds));

      entries.push(
        new RedmineTimeEntry(
          timeEntry['id'],
          timeEntry['project']['id'],
          timeEntry['comments'],
          start,
          end,
          durationInMilliseconds,
          timeEntry['issue'] ? timeEntry['issue']['id'] : undefined,
          timeEntry['activity']['id'],
          new Date(timeEntry['updated_on']),
        ),
      );
    });

    return entries;
  }

  async createTimeEntry(durationInMilliseconds: number, start: Date, end: Date, text: string, additionalData: ServiceObject[]): Promise<TimeEntry | null> {
    let projectId;
    let issueId;
    let activityId;

    for (const data of additionalData) {
      if (data.type === this._projectsType) {
        projectId = data.id;
      } else if (data.type === this._issuesType) {
        issueId = data.id;
      } else if (data.type === this._timeEntryActivitiesType) {
        activityId = data.id;
      }
    }

    if (!issueId && !projectId) {
      // issueId or projectId is required
      return null;
    }

    const hours = durationInMilliseconds / 1000 / 60 / 60;
    const timeEntryBody: Record<string, unknown> = {
      // minimum value in Redmine is 0.01, so if it is empty, insert exact 0.0, something between => 0.01, else > 0.01
      hours: (hours === 0.0 || hours > 0.01) ? hours : 0.01,
      spent_on: Utilities.getOnlyDateString(start),
      comments: text,
      user_id: this._serviceDefinition.config.userId,
      // if activityId not specified => fill with default from config
      activity_id: activityId ? activityId : this._serviceDefinition.config.defaultTimeEntryActivityId,
    };
    if (projectId) {
      timeEntryBody['project_id'] = projectId;
    }
    if (issueId) {
      timeEntryBody['issue_id'] = issueId;
    }

    const response = await superagent
      .post(this._timeEntriesUri)
      .accept('application/json')
      .type('application/json')
      .set('X-Redmine-API-Key', this._serviceDefinition.apiKey)
      .send({ time_entry: timeEntryBody });

    if (!response.ok) {
      return null;
    }

    const createdStart = new Date(response.body.time_entry['spent_on']);
    const createdEnd = new Date(new Date(response.body.time_entry['spent_on']).setMilliseconds(durationInMilliseconds));
    const createdDurationInMilliseconds = response.body.time_entry['hours'] * 60 * 60 * 1000;

    return new RedmineTimeEntry(
      response.body.time_entry['id'],
      response.body.time_entry['project']['id'],
      response.body.time_entry['comments'],
      createdStart,
      createdEnd,
      createdDurationInMilliseconds,
      response.body.time_entry['issue'] ? response.body.time_entry['issue']['id'] : undefined,
      response.body.time_entry['activity']['id'],
      new Date(response.body.time_entry['updated_on']),
    );
  }

  async deleteTimeEntry(id: string | number): Promise<boolean> {
    const response = await superagent
      .delete(`${this._timeEntriesUri.substring(0, this._timeEntriesUri.length - 5)}/${id}.json`)
      .accept('application/json')
      .type('application/json')
      .set('X-Redmine-API-Key', this._serviceDefinition.apiKey);

    return response.ok;
  }

  /**
   * Extracts project, issue and time entry activity and returns them as mappingObjects
   * @param timeEntry 
   * @param mappings 
   */
  extractMappingsObjectsFromTimeEntry(timeEntry: TimeEntry, mappings: Mapping[]): MappingsObject[] {
    // this should not happen
    if (!(timeEntry instanceof RedmineTimeEntry)) return [];

    const mappingsObjectsResult: MappingsObject[] = [];
    for (const mapping of mappings) {
      // ===  'Redmine' (is stored in this._serviceDefinition.name)
      const redmineMappingsObject = mapping.mappingsObjects.find(mappingsObject => mappingsObject.service === this._serviceDefinition.name);

      if (redmineMappingsObject) {
        // find project's mapping - should have same id as timeEntry.projectId
        if ((redmineMappingsObject.id === timeEntry.projectId && redmineMappingsObject.type === this._projectsType)
          || (redmineMappingsObject.id === timeEntry.issueId && redmineMappingsObject.type === this._issuesType)
          || (redmineMappingsObject.id === timeEntry.activityId && redmineMappingsObject.type === this._timeEntryActivitiesType)) {
          const otherProjectMappingsObjects = mapping.mappingsObjects.filter(mappingsObject => mappingsObject.service !== this._serviceDefinition.name);
          // push to result all other than 'Redmine'
          mappingsObjectsResult.push(...otherProjectMappingsObjects);
        }
      }
    }
    return mappingsObjectsResult;
  }
}