export class PlexConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlexConfigurationError';
  }
}
