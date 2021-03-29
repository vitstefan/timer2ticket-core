export class Config {
  /**
   * below Toggl specific
   */
  workspace?: Workspace | null;
  /**
   * below Redmine specific
   */
  apiPoint?: string | null;

  defaultTimeEntryActivity?: DefaultTimeEntryActivity | null;

  userId?: number;
}

class Workspace {
  id!: string | number;
  name!: string;
}

class DefaultTimeEntryActivity {
  id!: string | number;
  name!: string;
}