import { User } from "../models/user";

export abstract class SyncJob {
  protected _user: User;

  constructor(user: User) {
    this._user = user;
  }

  /**
   * Used for Sentry error logging
   */
  get userId(): string {
    return this._user._id.toString();
  }

  /**
   * Does the job, returns true if successfully done, false otherwise and needs to be repeated
   */
  abstract doTheJob(): Promise<boolean>;
}