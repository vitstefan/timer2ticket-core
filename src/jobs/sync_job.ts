import { User } from "../models/user";

export abstract class SyncJob {
  protected _user: User;

  constructor(user: User) {
    this._user = user;
  }
  /**
   * Does the job, returns true if successfully done, false otherwise and needs to be repeated
   */
  abstract doTheJob(): Promise<boolean>;
}