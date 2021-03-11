import express from 'express';
import { Queue } from 'typescript-collections';
import cron from 'node-cron';
// import sentry from '@sentry/node';
import bodyParser from 'body-parser';
import { ConfigSyncJob } from './jobs/config_sync_job';
import { SyncJob } from './jobs/sync_job';
import { TimeEntriesSyncJob } from './jobs/time_entries_sync_job';
import { Constants } from './shared/constants';
import { databaseService } from './shared/database_service';
import { User } from './models/user';

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// sentry.init({
//   dsn: "https://598d6ddbb7a14dd988bb2f1cbecdac2a@sentry.jagu.cz/29",
//   tracesSampleRate: 0.5,
// });

// queue for ConfigSyncJobs (CSJs) or TimeEntriesSyncJobs (TESJs)
const jobQueue = new Queue<SyncJob>();

// maps containing tasks to stop them if needed
// currently using when request comes from the client app (see below)
const activeUsersScheduledConfigSyncTasks = new Map<string, cron.ScheduledTask>();
const activeUsersScheduledTimeEntriesSyncTasks = new Map<string, cron.ScheduledTask>();

// TODO cleanUpJob - removes old projects, issues etc.

// every 5 seconds check if jobQueue is not empty
cron.schedule('*/5 * * * * *', () => {
  while (!jobQueue.isEmpty()) {
    const job = jobQueue.dequeue();

    // const sentryTransaction = sentry.startTransaction({
    //   op: 'job',
    //   name: 'Job transaction',
    // });

    if (job) {
      console.log(' -> Do the job');
      try {
        job.doTheJob().then(res => {
          if (res) {
            console.log(' -> Job successfully done.');
          } else {
            console.log(' -> Job unsuccessful.');
            // not successful, try to add again to the queue
            // TODO uncomment, but be careful with it (if commented, job will be retried again in another schedule tick)
            // do not want to be in the cycle => return to queue only twice or something...
            // console.log(' -> Added job again');
            // jobQueue.enqueue(job);
            // sentry.captureMessage('Job unsuccessful');
          }
        });
      } catch (ex) {
        // sentry.captureException(ex);
        // do not want to terminate whole app if something not ok
      } finally {
        // sentryTransaction.finish();
      }
    }
  }
});

// App init
app.listen(Constants.appPort, async () => {
  await databaseService.init();

  const activeUsers = await databaseService.getActiveUsers();

  activeUsers.forEach(user => {
    scheduleJobs(user);
  });

  return console.log(`Server is listening on ${Constants.appPort}`);
});

// Schedule jobs for given user
app.post('/api/start/:userId([a-zA-Z0-9]{24})', async (req, res) => {
  const userId = req.params.userId;
  // config probably changed 
  // => stop all scheduled cron tasks 
  // => get updated user from DB 
  // => start jobs again

  const configTask = activeUsersScheduledConfigSyncTasks.get(userId);
  const timeEntriesTask = activeUsersScheduledTimeEntriesSyncTasks.get(userId);

  if (configTask) {
    configTask.destroy();
    activeUsersScheduledConfigSyncTasks.delete(userId);
  }
  if (timeEntriesTask) {
    timeEntriesTask.destroy();
    activeUsersScheduledTimeEntriesSyncTasks.delete(userId);
  }

  const user = await databaseService.getUserById(userId);

  if (!user) {
    return res.sendStatus(404);
  }

  // schedule CSJ right now
  jobQueue.enqueue(new ConfigSyncJob(user));
  // and schedule next CSJs and TESJs by the user's normal schedule
  scheduleJobs(user);

  return res.send('User\'s jobs started successfully.');
});

// Stop all jobs for given user
app.post('/api/stop/:userId([a-zA-Z0-9]{24})', async (req, res) => {
  const userId = req.params.userId;
  // config probably changed 
  // => stop all scheduled cron tasks

  const configTask = activeUsersScheduledConfigSyncTasks.get(userId);
  const timeEntriesTask = activeUsersScheduledTimeEntriesSyncTasks.get(userId);

  if (!configTask && !timeEntriesTask) {
    return res.status(404).send('No jobs found for this user.');
  }

  if (configTask) {
    configTask.destroy();
    activeUsersScheduledConfigSyncTasks.delete(userId);
  }
  if (timeEntriesTask) {
    timeEntriesTask.destroy();
    activeUsersScheduledTimeEntriesSyncTasks.delete(userId);
  }

  return res.send('User\'s jobs stopped successfully.');
});

// Returns 204 if both config and TE jobs are scheduled for given user
app.post('/api/scheduled/:userId([a-zA-Z0-9]{24})', async (req, res) => {
  const userId = req.params.userId;

  const configTask = activeUsersScheduledConfigSyncTasks.get(userId);
  const timeEntriesTask = activeUsersScheduledTimeEntriesSyncTasks.get(userId);

  if (configTask && timeEntriesTask) {
    return res.send({ scheduled: true });
  }

  // return 200 OK if jobs are not scheduled (technically not error or something)
  return res.send({ scheduled: false });
});

function scheduleJobs(user: User) {
  console.log(`SCHEDULE jobs for user ${user._id}`);

  // cron schedule validation can be omitted (schedule is already validated when user - and schedule too - is updated)
  if (cron.validate(user.configSyncJobDefinition.schedule)) {
    const task = cron.schedule(user.configSyncJobDefinition.schedule, () => {
      console.log(' -> Added ConfigSyncJob');
      jobQueue.enqueue(new ConfigSyncJob(user));
    });
    activeUsersScheduledConfigSyncTasks.set(user._id.toString(), task);
  }

  if (cron.validate(user.timeEntrySyncJobDefinition.schedule)) {
    const task = cron.schedule(user.timeEntrySyncJobDefinition.schedule, async () => {
      const actualUser = await databaseService.getUserById(user._id.toString());
      // check if not null => there was at least 1 successful config job done => basic mappings should be there
      if (actualUser?.configSyncJobDefinition.lastSuccessfullyDone) {
        console.log(' -> Added TESyncJob');
        jobQueue.enqueue(new TimeEntriesSyncJob(actualUser));
      }
    });
    activeUsersScheduledTimeEntriesSyncTasks.set(user._id.toString(), task);
  }
}