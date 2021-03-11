import { MappingsObject } from "./mappings_object";

export class Mapping {
  primaryObjectId!: number | string;
  name!: string;
  mappingsObjects: MappingsObject[] = [];
}