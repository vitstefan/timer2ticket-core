import { ObjectId } from "mongodb";
import { JobDefinition } from "./job_definition";
import { Mapping } from "./mapping/mapping";
import { ServiceDefinition } from "./service_definition/service_definition";

export class User {
  _id!: string | ObjectId;
  username!: string;
  password!: string;
  registrated!: Date;
  status!: string;
  configSyncJobDefinition!: JobDefinition;
  timeEntrySyncJobDefinition!: JobDefinition;
  serviceDefinitions: ServiceDefinition[] = [];
  mappings: Mapping[] = [];
}