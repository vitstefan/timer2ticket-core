import { Mapping } from "../models/mapping/mapping";
import { MappingsObject } from "../models/mapping/mappings_object";
import { ServiceDefinition } from "../models/service_definition/service_definition";
import { ServiceObject } from "../models/synced_service/service_object/service_object";
import { databaseService } from "../shared/database_service";
import { SyncedServiceCreator } from "../synced_services/synced_service_creator";
import { SyncJob } from "./sync_job";

export class ConfigSyncJob extends SyncJob {
  /**
   * This job takes mappings from the user and checks if there are any problems with them
   * If there are no mappings, job is called probably for the first time for this user
   * Should create all mappings and sync all projects, issues etc. from primary service to the other ones
   * 
   * If mappings are there, should check if all are correct and updated
   * E.g. looks for project definition in one service and checks if mapping is synced in PRIMARY (for example name could change, or project has been deleted)
   * If not, updates mappings and propagates change through other services
   * Additionally, checks if anything is missing in the secondary services and it should be there (user could delete it by mistake)
   */
  async doTheJob(): Promise<boolean> {
    const primaryServiceDefinition: ServiceDefinition | undefined
      = this._user.serviceDefinitions.find(serviceDefinition => serviceDefinition.isPrimary);

    if (!primaryServiceDefinition) {
      throw 'Primary service definition not found.';
    }

    const primarySyncedService = SyncedServiceCreator.create(primaryServiceDefinition);

    // Gets all objects from primary to sync with the other ones
    const objectsToSync: ServiceObject[] = await primarySyncedService.getAllServiceObjects();

    // Check primary objects and mappings, if something is wrong, fix it
    // Scenarios (based on objects from primary service):
    // a) Mapping is missing
    //    => create mapping, propagate objects to other services
    // b) Mapping is there, but is incorrect (for example project name changed)
    //    => update mapping, propagate changes to other services
    // c) Mapping is there, but object is not there (in primary service)
    //    => delete objects from other services and delete mapping
    // d) Mapping is there and is the same as primary object
    //    => do nothing
    // e) Mapping is there, but mappingObject for given service is missing
    //    => create objects in service and add mappingObject to the mapping
    // f) Mapping is there, mappingObject for given service too, but real object is missing
    //    => create object in service

    // Also, if new service was added, this job should do the right job as it is

    // array of checked mappings (new ones or existing ones), used for finding obsolete mappings
    const checkedMappings: Mapping[] = [];

    let operationsOk = true;

    // Check all objectsToSync and their corresponding mapping
    for (const objectToSync of objectsToSync) {
      let mapping = this._user.mappings.find(mapping => mapping.primaryObjectId === objectToSync.id);

      try {
        if (!mapping) {
          // scenario a)
          console.log('ConfigSyncJob: create');
          mapping = await this._createMapping(objectToSync);
        } else {
          console.log('ConfigSyncJob: check');
          // scenario b), d), e), f)
          operationsOk &&= await this._checkMapping(objectToSync, mapping);
        }

        // push to checkedMappings
        // can be undefined from scenario a)
        checkedMappings.push(mapping);
      } catch (ex) {
        // TODO catch specific exception
        // console.log(ex);
        operationsOk = false;
      }
    }

    // obsolete mappings = user's mappings that were not checked => there is no primary object linked to it
    const obsoleteMappings =
      this._user
        .mappings
        .filter(
          mapping => checkedMappings.find(checkedMapping => checkedMapping === mapping)
            === undefined);

    if (obsoleteMappings.length > 0) {
      for (const mapping of obsoleteMappings) {
        // scenario c)
        operationsOk &&= await this._deleteMapping(mapping);
      }

      // and remove all obsolete mappings from user's mappings
      this._user.mappings
        = this._user
          .mappings
          .filter(
            mapping => obsoleteMappings.find(obsoleteMapping => obsoleteMapping === mapping)
              === undefined);
    }

    if (operationsOk) {
      // if all operations OK => set lastSuccessfullyDone (important to set not null for starting TE syncing)
      this._user.configSyncJobDefinition.lastSuccessfullyDone = new Date().getTime();
    }
    // persist changes in the mappings
    // even if some api operations were not ok, persist changes to the mappings - better than nothing
    await databaseService.updateUser(this._user);

    return operationsOk;
  }

  /**
   * Creates mapping based on objectToSync
   * @param user
   * @param objectToSync object from primary service
   */
  private async _createMapping(objectToSync: ServiceObject): Promise<Mapping> {
    // is wrapped in try catch block above
    const mapping = new Mapping();
    mapping.primaryObjectId = objectToSync.id;
    mapping.name = objectToSync.name;

    // for each service, create mappingsObject
    for (const serviceDefinition of this._user.serviceDefinitions) {
      const syncedService = SyncedServiceCreator.create(serviceDefinition);

      let mappingsObject;
      if (serviceDefinition.isPrimary) {
        // do not create real object in the service, it is already there, just create new serviceObject
        mappingsObject = new MappingsObject(objectToSync.id, objectToSync.name, serviceDefinition.name, objectToSync.type);
      } else {
        // firstly create object in the service, then create serviceObject with newly acquired id
        const createdObject = await syncedService.createServiceObject(objectToSync.id, objectToSync.name, objectToSync.type);
        console.log(`ConfigSyncJob: Created object ${createdObject.name}`);
        mappingsObject = new MappingsObject(createdObject.id, createdObject.name, serviceDefinition.name, createdObject.type);
      }

      mapping.mappingsObjects.push(mappingsObject);
      console.log(`ConfigSyncJob: Pushed serviceObject ${mappingsObject.type}`);
    }

    this._user.mappings.push(mapping);
    console.log(`ConfigSyncJob: Pushed mapping ${mapping.name}`);

    return mapping;
  }

  private async _checkMapping(objectToSync: ServiceObject, mapping: Mapping): Promise<boolean> {
    // is wrapped in try catch block above
    mapping.name = objectToSync.name;
    for (const serviceDefinition of this._user.serviceDefinitions) {
      if (serviceDefinition.isPrimary) {
        // for primary service, update only name, everything else should be ok
        const primaryMappingsObject = mapping.mappingsObjects.find(mappingObject => mappingObject.service === serviceDefinition.name);
        if (primaryMappingsObject) {
          primaryMappingsObject.name = objectToSync.name;
        }
        continue;
      }

      const syncedService = SyncedServiceCreator.create(serviceDefinition);

      const mappingsObject = mapping.mappingsObjects.find(mappingObject => mappingObject.service === serviceDefinition.name);

      if (!mappingsObject) {
        // scenario e)
        // mappingObject is missing, create a new one and add to mapping (maybe new service was added)
        // create a real object in the service and add mappingObject
        // firstly create object in the service, then create serviceObject with newly acquired id
        const newObject = await syncedService.createServiceObject(objectToSync.id, objectToSync.name, objectToSync.type);
        console.log(`ConfigSyncJob: Created object ${newObject.name}`);
        const newMappingsObject = new MappingsObject(newObject.id, newObject.name, serviceDefinition.name, newObject.type);
        mapping.mappingsObjects.push(newMappingsObject);
      } else {
        // scenario b), d), f)
        // check if mapping corresponds with real object in the service
        const objectBasedOnMapping = await syncedService.getServiceObject(mappingsObject.id, mappingsObject.type);
        if (!objectBasedOnMapping) {
          // scenario f), create new object in the service
          const newObject = await syncedService.createServiceObject(objectToSync.id, objectToSync.name, objectToSync.type);
          console.log(`ConfigSyncJob: Created object ${newObject.name}`);
          mappingsObject.id = newObject.id;
          mappingsObject.name = newObject.name;
          mappingsObject.lastUpdated = Date.now();
        } else if (objectBasedOnMapping.name !== syncedService.getFullNameForServiceObject(objectToSync)) {
          // scenario b)
          // name is incorrect => maybe mapping was outdated or/and real object was outdated
          const updatedObject = await syncedService.updateServiceObject(
            mappingsObject.id, new ServiceObject(objectToSync.id, objectToSync.name, objectToSync.type)
          );
          console.log(`ConfigSyncJob: Updated object ${updatedObject.name}`);
          mappingsObject.name = updatedObject.name;
          mappingsObject.lastUpdated = Date.now();
        } else {
          // scenario d)
          // everything OK, do nothing
        }
      }
    }

    return true;
  }

  private async _deleteMapping(mapping: Mapping): Promise<boolean> {
    let operationsOk = true;

    for (const mappingObject of mapping.mappingsObjects) {
      const serviceDefinition = this._user.serviceDefinitions.find(serviceDefinition => serviceDefinition.name === mappingObject.service);

      // if serviceDefinition not found or isPrimary => means do not delete project from primary service since it is not there
      if (!serviceDefinition || serviceDefinition.isPrimary) continue;

      const syncedService = SyncedServiceCreator.create(serviceDefinition);
      operationsOk &&= await syncedService.deleteServiceObject(mappingObject.id, mappingObject.type);
      console.log(`ConfigSyncJob: Deleted object ${mapping.name}`);
    }

    // if any of those operations did fail, return false
    return operationsOk;
  }
}