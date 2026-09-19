// jsdom doesn't implement ResizeObserver. Shared fake for any test that
// needs to install one and trigger its callback manually.
export class MockResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.observed = [];
    MockResizeObserver.instances.push(this);
  }

  observe(target) {
    this.observed.push(target);
  }

  disconnect() {
    this.disconnected = true;
  }

  trigger() {
    this.callback([], this);
  }
}
MockResizeObserver.instances = [];
