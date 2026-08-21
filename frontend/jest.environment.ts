import JSDOMEnvironment from "jest-environment-jsdom";

export default class GuardianTestEnvironment extends JSDOMEnvironment {
  constructor(...args: ConstructorParameters<typeof JSDOMEnvironment>) {
    super(...args);

    Object.assign(this.global, {
      fetch,
      Response,
      Request,
      Headers,
      FormData,
      ReadableStream,
      TextEncoder,
      TextDecoder,
      structuredClone,
    });
  }
}
