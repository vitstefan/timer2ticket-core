export class Constants {
  static appPort = 3000;

  static mongoDbUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017';
}