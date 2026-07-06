import { CircuitBreakerService } from './circuit-breaker.service';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(() => {
    service = new CircuitBreakerService();
    // Reset private state (access via any)
    (service as any).state = 0; // CLOSED
    (service as any).failureCount = 0;
  });

  it('should successfully call the wrapped function when CLOSED', async () => {
    const result = await service.call(async () => 'success');
    expect(result).toBe('success');
  });

  it('should open circuit after 5 failures', async () => {
    const failingFn = async () => { throw new Error('fail'); };

    for (let i = 0; i < 5; i++) {
      await expect(service.call(failingFn)).rejects.toThrow('fail');
    }

    // 6th call should be blocked by OPEN circuit
    await expect(service.call(failingFn)).rejects.toThrow('Circuit breaker is OPEN');
  });

  it('should transition to HALF_OPEN after timeout', async () => {
    const failingFn = async () => { throw new Error('fail'); };

    // Cause 5 failures to open circuit
    for (let i = 0; i < 5; i++) {
      await expect(service.call(failingFn)).rejects.toThrow('fail');
    }

    // Manually set lastFailureTime to be in the past (beyond 30s timeout)
    (service as any).lastFailureTime = Date.now() - 35000;

    // This should transition to HALF_OPEN and attempt the call
    await expect(service.call(failingFn)).rejects.toThrow('fail');
    // After another failure in HALF_OPEN, state should be OPEN again
  });

  it('should reset failure count on success', async () => {
    const failingFn = async () => { throw new Error('fail'); };
    const successFn = async () => 'ok';

    // 3 failures
    for (let i = 0; i < 3; i++) {
      await expect(service.call(failingFn)).rejects.toThrow('fail');
    }

    // Success resets
    const result = await service.call(successFn);
    expect(result).toBe('ok');

    // State should be CLOSED with 0 failures
    expect((service as any).failureCount).toBe(0);
    expect((service as any).state).toBe(0); // CLOSED
  });

  it('should return current state via getState', () => {
    const state = (service as any).getState();
    // CLOSED = 0
    expect(state).toBe(0);
  });

  it('should reset to CLOSED on reset()', async () => {
    const failingFn = async () => { throw new Error('fail'); };

    // Open the circuit
    for (let i = 0; i < 5; i++) {
      await expect(service.call(failingFn)).rejects.toThrow('fail');
    }

    // Reset
    (service as any).reset();

    // Should allow calls again
    const result = await service.call(async () => 'recovered');
    expect(result).toBe('recovered');
  });
});
